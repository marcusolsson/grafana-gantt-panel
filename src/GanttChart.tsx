import React, { useState, useRef } from 'react';
import * as d3 from 'd3';
import humanizeDuration from 'humanize-duration';

import {
  AbsoluteTimeRange,
  dateTimeFormat,
  Field,
  FieldType,
  GrafanaTheme,
  SelectableValue,
  TimeRange,
} from '@grafana/data';
import { Badge, graphTimeFormat, Select, stylesFactory, useTheme } from '@grafana/ui';

import { measureText, getFormattedDisplayValue } from 'grafana-plugin-support';
import { css } from 'emotion';
import dayjs from 'dayjs';
import { labelColor } from './helpers';
import { GanttTask } from './GanttTask';

type Point = {
  x: number;
  y: number;
};

interface Props {
  textField: Field<string>;
  startField: Field<number>;
  endField: Field<number>;
  colorByField: Field;
  groupByField?: Field;
  labelFields: Array<Field | undefined>;

  width: number;
  height: number;

  timeRange: TimeRange;
  timeZone: string;
  onChangeTimeRange: (timeRange: AbsoluteTimeRange) => void;

  sortBy: any;
  sortOrder: any;
  colors?: Array<{ text: string; color: string }>;

  showYAxis: boolean;

  experiments: any;
}

export const GanttChart = ({
  textField,
  startField,
  endField,
  colorByField,
  groupByField,
  labelFields,
  width,
  height,
  timeRange,
  timeZone,
  onChangeTimeRange,
  experiments,
  sortBy,
  sortOrder,
  colors,
  showYAxis,
}: Props) => {
  const [group, setGroup] = useState<string>();

  const theme = useTheme();
  const styles = getStyles(theme);

  const onGroupChange = (selectableValue: SelectableValue<string>) => {
    setGroup(selectableValue.value);
  };

  const svgRef = useRef<SVGSVGElement>(null);

  // Zoom state
  const [dragging, setDragging] = useState(false);
  const [isMouseDown, setMouseDown] = useState(false);
  const [coordinates, setCoordinates] = useState<Point>({ x: 0, y: 0 });
  const [origin, setOrigin] = useState<Point>({ x: 0, y: 0 });

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

  const absoluteMode = experiments.enabled ? !experiments.lockToExtents : currentGroup === undefined;

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
      (experiments.enabled && experiments.lockToExtents)
    );
  });

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
    left: 10 + (showYAxis ? widestLabel : 0),
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

  // Limit bar height to 25% of chartHeight.
  const barHeightLimit = 0.25;
  const scalePadding = Math.max((1 - barHeightLimit * taskLabels.length) / (1 + barHeightLimit), 0);

  const scaleY = d3.scaleBand().domain(taskLabels).range([0, chartHeight]).padding(scalePadding);
  const axisX = d3.axisBottom(scaleX).tickFormat((d) => {
    if (experiments.enabled && experiments.relativeXAxis) {
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
    x: origin.x + (coordinates.x - origin.x < 0 ? coordinates.x - origin.x : 0),
    y: 0,
    width: Math.abs(coordinates.x - origin.x),
    height: height - padding.bottom,
  };

  return (
    <div>
      <svg
        ref={svgRef}
        className={styles.svg}
        width={width}
        height={height - (selectableGroups.length > 0 ? 40 : 0)}
        xmlns="http://www.w3.org/2000/svg"
        xmlnsXlink="http://www.w3.org/1999/xlink"
        onMouseDown={(e) => {
          setMouseDown(true);

          const coord = coordClientToViewbox({ x: e.clientX, y: e.clientY });

          if (coord) {
            setOrigin(coord);
          }
        }}
        onMouseMove={(e) => {
          const coord = coordClientToViewbox({ x: e.clientX, y: e.clientY });

          if (coord) {
            setCoordinates(coord);

            if (isMouseDown && absoluteMode) {
              const distance = Math.sqrt(Math.pow(origin.x - coord.x, 2) + Math.pow(origin.y - coord.y, 2));
              if (distance > 5) {
                setDragging(true);
              }
            }
          }
        }}
        onMouseUp={() => {
          setMouseDown(false);

          if (dragging && absoluteMode) {
            // We use onChangeTimeRange updates the time interval for the
            // dashboard.
            onChangeTimeRange({
              from: invertedScaleX(zoomWindow.x - padding.left),
              to: invertedScaleX(zoomWindow.x + zoomWindow.width - padding.left),
            });

            setDragging(false);
          }
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
              y: scaleY(label) ?? 0,
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

            const fillColor = colorByField
              ? colorByField.type === FieldType.number
                ? colorByField.display!(colorByField.values.get(i)).color!
                : labelColor(colorByField.values.get(i), theme, colors)
              : 'black';

            return (
              <GanttTask
                key={i}
                x={taskBarPos.x}
                y={taskBarPos.y}
                width={taskBarWidth}
                height={taskBarHeight}
                color={fillColor}
                tooltip={tooltipContent}
                links={textField.getLinks!({ valueRowIndex: i })}
              />
            );
          })}
        </g>

        {/* Zoom window */}
        {absoluteMode && dragging && (
          <rect fill={theme.colors.text} opacity={0.1} pointerEvents="none" {...zoomWindow} />
        )}

        {/* X-axis */}
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

        {/* Y-axis */}
        {showYAxis && (
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
        )}
      </svg>
      {selectableGroups.length > 0 ? (
        <div className={styles.frameSelect}>
          <Select onChange={onGroupChange} value={currentGroup} options={selectableGroups} />
        </div>
      ) : null}
    </div>
  );
};

const isBetween = (from: dayjs.Dayjs, to: dayjs.Dayjs) => (date: dayjs.Dayjs) => {
  return !(date.isBefore(from) || date.isAfter(to));
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
