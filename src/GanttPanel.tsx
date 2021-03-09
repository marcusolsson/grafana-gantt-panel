import React, { useState, useRef } from 'react';
import { css, cx } from 'emotion';
import * as d3 from 'd3';
import Tippy from '@tippyjs/react';

import dayjs from 'dayjs';

import humanizeDuration from 'humanize-duration';

import { dateTimeFormat, FieldType, GrafanaTheme, PanelProps, SelectableValue } from '@grafana/data';
import { stylesFactory, useTheme, Select, Badge, graphTimeFormat } from '@grafana/ui';

import { GanttOptions } from './types';
import { measureText, toTimeField, getFormattedDisplayValue, PanelWizard } from 'grafana-plugin-support';

type Point = {
  x: number;
  y: number;
};

const usage = {
  schema: [
    { type: FieldType.string, description: 'Task name' },
    { type: FieldType.time, description: 'Task start time' },
    { type: FieldType.time, description: 'Task end time' },
  ],
  url: 'https://github.com/marcusolsson/grafana-gantt-panel',
};

interface Props extends PanelProps<GanttOptions> {}

export const GanttPanel: React.FC<Props> = ({
  options,
  data,
  width,
  height,
  timeRange,
  onChangeTimeRange,
  timeZone,
}) => {
  const [group, setGroup] = useState<string>();
  const svgRef = useRef<SVGSVGElement>(null);

  // Zoom state
  const [dragging, setDragging] = useState(false);
  const [coordinates, setCoordinates] = useState<Point>({ x: 0, y: 0 });
  const [origin, setOrigin] = useState<Point>({ x: 0, y: 0 });

  const theme = useTheme();
  const styles = getStyles(theme);

  const onGroupChange = (selectableValue: SelectableValue<string>) => {
    setGroup(selectableValue.value);
  };

  // coordClientToViewbox converts a client coordinate to a coordinate inside
  // the SVG's viewbox. We need this to translate the mouse cursor position into
  // corresponding timestamp.
  const coordClientToViewbox = (pt: Point): Point | undefined => {
    if (svgRef.current) {
      const matrix = svgRef.current.getScreenCTM();

      if (matrix) {
        const clientPoint = svgRef.current.createSVGPoint();

        clientPoint.x = pt.x;
        clientPoint.y = pt.x;

        return clientPoint.matrixTransform(matrix.inverse());
      }
    }
    return undefined;
  };

  // TODO: Support multiple data frames.
  const frame = data.series[0];

  // Display help text if no data was found.
  if (!frame) {
    return (
      <div style={{ width, height }}>
        <PanelWizard {...usage} />
      </div>
    );
  }

  // Find the fields we're going to be using for the visualization. If the user
  // has set the field explicitly we use that one, otherwise we guess based on
  // the expected field type.
  const textField = options.textField
    ? frame.fields.find((f) => f.name === options.textField)
    : frame.fields.find((f) => f.type === FieldType.string);

  const startField = toTimeField(
    options.startField
      ? frame.fields.find((f) => f.name === options.startField)
      : frame.fields.find((f) => f.type === FieldType.time),
    timeZone
  );

  const endField = toTimeField(
    options.endField
      ? frame.fields.find((f) => f.name === options.endField)
      : frame.fields.filter((f) => f !== startField).find((f) => f.type === FieldType.time)
  );

  const groupByField = frame.fields.find((f) => f.name === options.groupByField);

  const labelFields = options.labelFields?.map((_) => frame.fields.find((f) => f.name === _)) ?? [];

  // Make sure that all fields have been configured before we continue.
  if (!textField || !startField || !endField) {
    return (
      <div style={{ width, height }}>
        <PanelWizard
          {...usage}
          fields={frame.fields.map((field) => {
            // If the user set a number or string field as time, use the
            // converted fields instead.
            if (startField && startField.name === field.name) {
              return startField;
            }
            if (endField && endField.name === field.name) {
              return endField;
            }
            return field;
          })}
        />
      </div>
    );
  }

  // Group row indexes by the value in the groupBy field.
  const groups: { [value: string]: number[] } = groupByField
    ? groupByField.values.toArray().reduce((acc, curr, idx) => {
        if (!acc[curr]) {
          acc[curr] = [];
        }
        acc[curr].push(idx);
        return acc;
      }, {})
    : {};

  const selectableGroups = Object.keys(groups).map((group) => ({
    label: group,
    value: group,
  }));

  const currentGroup = group ?? (selectableGroups.length > 0 ? selectableGroups[0].value : undefined);

  const absoluteMode = options.experiments.enabled ? !options.experiments.lockToExtents : currentGroup === undefined;

  const indexes =
    selectableGroups.length > 0 && currentGroup
      ? groups[currentGroup]
      : textField.values.toArray().map((_, idx) => idx);

  const from = dayjs(timeRange.from.valueOf());
  const to = dayjs(timeRange.to.valueOf());

  const isWithinTimeRange = isBetween(from, to);

  // Filter out any tasks that aren't visible in the selected time interval.
  const visibleIndexes = indexes.filter((idx) => {
    const start = dayjs(startField.values.get(idx));
    const end = dayjs(endField.values.get(idx));

    return (
      isWithinTimeRange(start) ||
      isWithinTimeRange(end) ||
      // If Lock to extents is enabled, all tasks should be visible.
      (options.experiments.enabled && options.experiments.lockToExtents)
    );
  });

  const { sortBy, sortOrder } = options;

  const sortedIndexes = visibleIndexes.sort((a, b) => {
    const [i, j] = sortOrder === 'asc' ? [a, b] : [b, a];

    switch (sortBy) {
      case 'text':
        return textField.values.get(i).localeCompare(textField.values.get(j));
      case 'startTime':
        return startField.values.get(i) - startField.values.get(j);
      default:
        return i - j;
    }
  });

  const taskLabels = [...new Set(sortedIndexes.map((_) => textField.values.get(_)))];
  const widestLabel = d3.max(taskLabels.map((_) => measureText(_, theme.typography.size.sm)?.width ?? 0)) ?? 0;

  const padding = {
    left: 10 + widestLabel,
    top: 0,
    bottom: 30 + (selectableGroups.length > 0 ? 40 : 0),
    right: 10,
  };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Find the time range based on the earliest start time and the latest end time.
  const timeExtents: [dayjs.Dayjs, dayjs.Dayjs] = [
    sortedIndexes
      .map((_) => startField.values.get(_))
      .reduce((acc: dayjs.Dayjs, curr: number) => {
        const currDateTime = dayjs(curr);
        return currDateTime.isBefore(acc) ? currDateTime : acc;
      }, dayjs()),
    sortedIndexes
      .map((_) => endField.values.get(_))
      .reduce((acc: dayjs.Dayjs, curr: number) => {
        const currDateTime = dayjs(curr);
        return acc.isBefore(currDateTime) ? currDateTime : acc;
      }, dayjs(0)),
  ];

  // Scale for converting from time to pixel.
  const getExtents = (): [Date, Date] => {
    const { experiments } = options;

    if (experiments.enabled) {
      if (experiments.lockToExtents) {
        return [timeExtents[0].toDate(), timeExtents[1].toDate()];
      }
      return [from.toDate(), to.toDate()];
    }

    return [
      groupByField ? timeExtents[0].toDate() : from.toDate(),
      groupByField ? timeExtents[1].toDate() : to.toDate(),
    ];
  };

  let scaleX: any = d3.scaleTime().domain(getExtents()).range([0, chartWidth]);

  // Scale for converting from pixel to time. Used for the zoom window.
  const invertedScaleX = d3.scaleLinear().domain([0, chartWidth]).range([from.valueOf(), to.valueOf()]);

  //Limit bar height to 25% of chartHeight.
  const barHeightLimit = 0.25;
  const scalePadding = Math.max((1 - barHeightLimit * taskLabels.length) / (1 + barHeightLimit), 0);

  const scaleY = d3.scaleBand().domain(taskLabels).range([0, chartHeight]).padding(scalePadding);

  const axisX = d3.axisBottom(scaleX).tickFormat((d) => {
    if (options.experiments.enabled && options.experiments.relativeXAxis) {
      const duration = (d as number) - timeExtents[0].valueOf();
      if (duration < 0) {
        return '';
      }
      return humanizeDuration(duration, { largest: 1 });
    }

    const range = scaleX.domain();
    const format = graphTimeFormat(scaleX.ticks().length, range[0].valueOf(), range[1].valueOf());
    return dateTimeFormat(d as number, { format, timeZone });
  });

  const axisY = d3.axisLeft(scaleY);

  const zoomWindow = {
    x: origin.x + (coordinates.x < 0 ? coordinates.x : 0),
    y: 0,
    width: Math.abs(coordinates.x),
    height: height - padding.bottom,
  };

  return (
    <div
      className={cx(css`
        width: ${width}px;
        height: ${height}px;
        user-select: none;
      `)}
    >
      <div>
        <svg
          ref={svgRef}
          className={styles.svg}
          width={width}
          height={height - (selectableGroups.length > 0 ? 40 : 0)}
          xmlns="http://www.w3.org/2000/svg"
          xmlnsXlink="http://www.w3.org/1999/xlink"
          onMouseDown={(e) => {
            if (!absoluteMode) {
              return;
            }

            const pt = coordClientToViewbox({ x: e.clientX, y: e.clientY });

            if (pt) {
              setOrigin(pt);
            }

            setDragging(true);
          }}
          onMouseMove={(e) => {
            if (!absoluteMode) {
              return;
            }

            if (dragging) {
              const pt = coordClientToViewbox({ x: e.clientX - origin.x, y: e.clientY - origin.y });

              if (pt) {
                setCoordinates(pt);
              }
            }
          }}
          onMouseUp={() => {
            if (!absoluteMode) {
              return;
            }

            setCoordinates({ x: 0, y: 0 });
            setDragging(false);

            // We use onChangeTimeRange updates the time interval for the
            // dashboard.
            onChangeTimeRange({
              from: invertedScaleX(zoomWindow.x - padding.left),
              to: invertedScaleX(zoomWindow.x + zoomWindow.width - padding.left),
            });
          }}
        >
          {/* Task bars */}
          <g>
            {sortedIndexes.map((i) => {
              const label = textField.values.get(i);
              const startTimeValue = startField.values.get(i);
              const endTimeValue = endField.values.get(i);

              const startTime = dayjs(startTimeValue);
              const endTime = dayjs(endTimeValue);

              const pixelStartX = startTimeValue ? Math.max(scaleX(startTime.toDate()), 0) : 0;
              const pixelEndX = endTimeValue ? Math.min(scaleX(endTime.toDate()), chartWidth) : chartWidth;

              const barPadding = 2;
              const taskBarWidth = Math.max(pixelEndX - pixelStartX - 2, 1);
              const taskBarHeight = scaleY.bandwidth() - barPadding;

              const taskBarPos = {
                x: pixelStartX + padding.left,
                y: scaleY(label),
              };

              const tooltipContent = (
                <div>
                  <div className={styles.tooltip.header}>{label}</div>
                  {startTimeValue && (
                    <div className={styles.tooltip.value}>Started at: {startField.display!(startTimeValue).text}</div>
                  )}
                  {endTimeValue && (
                    <div className={styles.tooltip.value}>Ended at: {endField.display!(endTimeValue).text}</div>
                  )}
                  <div className={styles.tooltip.faint}>
                    {humanizeDuration((endTimeValue || Date.now()) - startTimeValue, { largest: 2 })}
                  </div>
                  <div>
                    {labelFields
                      .filter((field) => field?.values.get(i))
                      .map((field) => field?.display!(field?.values.get(i)))
                      .map(getFormattedDisplayValue)
                      .map((label, key) => (
                        <Badge key={key} className={styles.tooltip.badge} text={label ?? ''} color="blue" />
                      ))}
                  </div>
                </div>
              );

              return (
                <Tippy
                  maxWidth={500}
                  content={tooltipContent}
                  key={i}
                  placement="bottom"
                  animation={false}
                  className={styles.tooltip.root}
                >
                  <rect
                    fill={'rgb(115, 191, 105)'}
                    x={taskBarPos.x}
                    y={taskBarPos.y}
                    width={taskBarWidth}
                    height={taskBarHeight}
                    rx={theme.border.radius.sm}
                    ry={theme.border.radius.sm}
                  />
                </Tippy>
              );
            })}
          </g>

          {/* Zoom window */}
          {absoluteMode && <rect fill={'#ffffff'} opacity={0.1} {...zoomWindow} />}

          {/* Axes */}
          <g
            transform={`translate(${padding.left}, ${height - (padding.top + padding.bottom)})`}
            ref={(node) => {
              d3.select(node).call(axisX as any);
            }}
            className={css`
              font-family: ${theme.typography.fontFamily.sansSerif};
              font-size: ${theme.typography.size.sm};
            `}
          />
          <g
            transform={`translate(${padding.left}, 0)`}
            ref={(node) => {
              d3.select(node).call(axisY as any);
            }}
            className={css`
              font-family: ${theme.typography.fontFamily.sansSerif};
              font-size: ${theme.typography.size.sm};
            `}
          />
        </svg>
      </div>
      {selectableGroups.length > 0 ? (
        <div className={styles.frameSelect}>
          <Select onChange={onGroupChange} value={currentGroup} options={selectableGroups} />
        </div>
      ) : null}
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    svg: css`
      flex: 1;
    `,
    root: css`
      display: flex;
      flex-direction: column;
    `,
    frameSelect: css``,
    tooltip: {
      root: css`
        border-radius: ${theme.border.radius.md};
        background-color: ${theme.colors.bg2};
        padding: ${theme.spacing.sm};
        box-shadow: 0px 0px 20px ${theme.colors.dropdownShadow};
      `,
      header: css`
        font-weight: ${theme.typography.weight.semibold};
        font-size: ${theme.typography.size.md};
        margin-bottom: ${theme.spacing.sm};
        color: ${theme.colors.text};
      `,
      value: css`
        font-size: ${theme.typography.size.md};
        margin-bottom: ${theme.spacing.xs};
      `,
      faint: css`
        font-size: ${theme.typography.size.md};
        margin-bottom: ${theme.spacing.xs};
        color: ${theme.colors.textSemiWeak};
      `,
      badge: css`
        margin-right: ${theme.spacing.xs};
        &:last-child {
          margin-right: 0;
        }
        overflow: hidden;
        max-width: 100%;
      `,
    },
  };
});

const isBetween = (from: dayjs.Dayjs, to: dayjs.Dayjs) => (date: dayjs.Dayjs) => {
  return !(date.isBefore(from) || date.isAfter(to));
};
