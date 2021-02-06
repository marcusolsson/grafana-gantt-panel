import React, { useState, useRef } from 'react';
import { css, cx } from 'emotion';
import * as d3 from 'd3';
import Tippy from '@tippyjs/react';

import humanizeDuration from 'humanize-duration';

import { FieldType, PanelProps, dateTimeFormat, dateTimeParse, DateTime, SelectableValue } from '@grafana/data';
import { graphTimeFormat, stylesFactory, useTheme, InfoBox, Select, Badge } from '@grafana/ui';

import { GanttOptions } from './types';
import { measureText, ensureTimeField, getFormattedDisplayValue } from './helpers';

type Point = {
  x: number;
  y: number;
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
  const styles = getStyles();

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
      <div style={{ width, height, overflow: 'hidden' }}>
        <InfoBox
          title="Configure your panel"
          url="https://github.com/marcusolsson/grafana-gantt-panel"
          severity="info"
          style={{ width: '100%', height: '100%' }}
        >
          <p>
            Update your query to return at least:
            <ul style={{ marginLeft: 20, marginTop: 10 }}>
              <li>A text field</li>
              <li>Two time fields</li>
            </ul>
          </p>
        </InfoBox>
      </div>
    );
  }

  // Find the fields we're going to be using for the visualization. If the user
  // has set the field explicitly we use that one, otherwise we guess based on
  // the expected field type.
  const textField = options.textField
    ? frame.fields.find(f => f.name === options.textField)
    : frame.fields.find(f => f.type === FieldType.string);

  const startField = ensureTimeField(
    options.startField
      ? frame.fields.find(f => f.name === options.startField)
      : frame.fields.find(f => f.type === FieldType.time),
    timeZone
  );

  const endField = ensureTimeField(
    options.endField
      ? frame.fields.find(f => f.name === options.endField)
      : frame.fields.filter(f => f !== startField).find(f => f.type === FieldType.time)
  );

  const groupByField = frame.fields.find(f => f.name === options.groupByField);

  const labelFields = options.labelFields?.map(_ => frame.fields.find(f => f.name === _)) ?? [];

  // Make sure that all fields have been configured before we continue.
  if (!textField || !startField || !endField) {
    return (
      <div style={{ width, height, overflow: 'hidden' }}>
        <InfoBox
          title="Configure your panel"
          url="https://github.com/marcusolsson/grafana-gantt-panel"
          severity="info"
          style={{ width: '100%', height: '100%' }}
        >
          <p>
            Update your query to return at least:
            <ul style={{ marginLeft: 20, marginTop: 10 }}>
              <li>A text field</li>
              <li>Two time fields</li>
            </ul>
          </p>
        </InfoBox>
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

  const selectableGroups = Object.keys(groups).map(group => ({
    label: group,
    value: group,
  }));

  const currentGroup = group ?? (selectableGroups.length > 0 ? selectableGroups[0].value : undefined);

  const absoluteMode = currentGroup === undefined;

  const indexes =
    selectableGroups.length > 0 && currentGroup
      ? groups[currentGroup]
      : textField.values.toArray().map((_, idx) => idx);

  // Sort rows by start time.
  const sortedIndexes = indexes.sort((a, b) => {
    return startField.values.get(a) - startField.values.get(b);
  });

  // Find the time range based on the earliest start time and the latest end time.
  const timeExtents: [DateTime, DateTime] = [
    sortedIndexes
      .map(_ => startField.values.get(_))
      .reduce((acc: DateTime, curr: number) => {
        const currDateTime = dateTimeParse(curr, { timeZone });
        return currDateTime.isBefore(acc) ? currDateTime : acc;
      }, dateTimeParse(Date.now())),
    sortedIndexes
      .map(_ => endField.values.get(_))
      .reduce((acc: DateTime, curr: number) => {
        const currDateTime = dateTimeParse(curr, { timeZone });
        return acc.isBefore(currDateTime) ? currDateTime : acc;
      }, dateTimeParse(0)),
  ];

  const activityLabels = [...new Set(sortedIndexes.map(_ => textField.values.get(_)))];
  const widestLabel = d3.max(activityLabels.map(_ => measureText(_, theme.typography.size.sm))) ?? 0;

  const padding = {
    left: 10 + widestLabel,
    top: 0,
    bottom: 30 + (selectableGroups.length > 0 ? 40 : 0),
    right: 10,
  };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Scale for converting from time to pixel.
  const absoluteScaleX = d3
    .scaleTime()
    .domain([
      groupByField ? timeExtents[0] : timeRange.from.toDate(),
      groupByField ? timeExtents[1] : timeRange.to.toDate(),
    ])
    .range([0, chartWidth]);

  // Scale for converting from pixel to time. Used for the zoom window.
  const invertedScaleX = d3
    .scaleLinear()
    .domain([0, chartWidth])
    .range([timeRange.from.toDate().valueOf(), timeRange.to.toDate().valueOf()]);

  const scaleY = d3
    .scaleBand()
    .domain(activityLabels)
    .range([0, chartHeight]);

  const range = absoluteScaleX.domain();
  const format = graphTimeFormat(absoluteScaleX.ticks().length, range[0].valueOf(), range[1].valueOf());

  const axisX = d3.axisBottom(absoluteScaleX).tickFormat(d => dateTimeFormat(d as number, { format, timeZone }));
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
          onMouseDown={e => {
            if (!absoluteMode) {
              return;
            }

            const pt = coordClientToViewbox({ x: e.clientX, y: e.clientY });

            if (pt) {
              setOrigin(pt);
            }

            setDragging(true);
          }}
          onMouseMove={e => {
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
          {/* Activity bars */}
          <g>
            {sortedIndexes.map(i => {
              const label = textField.values.get(i);
              const startTimeValue = startField.values.get(i);
              const endTimeValue = endField.values.get(i);

              const startTime = dateTimeParse(startTimeValue, { timeZone });
              const endTime = dateTimeParse(endTimeValue, { timeZone });

              const pixelStartX = startTimeValue ? Math.max(absoluteScaleX(startTime.toDate()), 0) : 0;
              const pixelEndX = endTimeValue ? Math.min(absoluteScaleX(endTime.toDate()), chartWidth) : chartWidth;

              const barPadding = 2;
              const activityBarWidth = Math.max(pixelEndX - pixelStartX - 2, 1);
              const activityBarHeight = scaleY.bandwidth() - barPadding;

              const activityBarPos = {
                x: pixelStartX + padding.left,
                y: scaleY(label),
              };

              const tooltipStyles = {
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
              };

              const tooltipContent = (
                <div>
                  <div className={tooltipStyles.header}>{label}</div>
                  {startTimeValue && (
                    <div className={tooltipStyles.value}>Started at: {startField.display!(startTimeValue).text}</div>
                  )}
                  {endTimeValue && (
                    <div className={tooltipStyles.value}>Ended at: {endField.display!(endTimeValue).text}</div>
                  )}
                  <div className={tooltipStyles.faint}>
                    {humanizeDuration((endTimeValue || Date.now()) - startTimeValue, { largest: 2 })}
                  </div>
                  <div>
                    {labelFields
                      .filter(_ => _?.values.get(i))
                      .map(_ => _?.display!(_?.values.get(i)))
                      .map(getFormattedDisplayValue)
                      .map(_ => (
                        <Badge
                          className={css`
                            margin-right: ${theme.spacing.xs};
                            &:last-child {
                              margin-right: 0;
                            }
                          `}
                          text={_ ?? ''}
                          color="blue"
                        />
                      ))}
                  </div>
                </div>
              );

              return (
                <Tippy
                  content={tooltipContent}
                  key={i}
                  placement="bottom"
                  animation={false}
                  className={tooltipStyles.root}
                >
                  <rect
                    fill={'rgb(115, 191, 105)'}
                    x={activityBarPos.x}
                    y={activityBarPos.y}
                    width={activityBarWidth}
                    height={activityBarHeight}
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
            ref={node => {
              d3.select(node).call(axisX as any);
            }}
            className={css`
              font-family: ${theme.typography.fontFamily.sansSerif};
              font-size: ${theme.typography.size.sm};
            `}
          />
          <g
            transform={`translate(${padding.left}, 0)`}
            ref={node => {
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

const getStyles = stylesFactory(() => {
  return {
    svg: css`
      flex: 1;
    `,
    root: css`
      display: flex;
      flex-direction: column;
    `,
    frameSelect: css``,
  };
});
