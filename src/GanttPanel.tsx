import React, { useState } from 'react';
import { css, cx } from 'emotion';
import * as d3 from 'd3';
import Tippy from '@tippyjs/react';

import humanizeDuration from 'humanize-duration';

import { FieldType, PanelProps, dateTimeFormat, dateTimeParse, DateTime, SelectableValue } from '@grafana/data';
import { graphTimeFormat, stylesFactory, useTheme, InfoBox, Select } from '@grafana/ui';

import { GanttOptions } from './types';
import { measureText, ensureTimeField } from './helpers';

interface Props extends PanelProps<GanttOptions> {}

export const GanttPanel: React.FC<Props> = ({ options, data, width, height, timeRange, timeZone }) => {
  const theme = useTheme();
  const styles = getStyles();

  const [group, setGroup] = useState<string>();

  const onGroupChange = (selectableValue: SelectableValue<string>) => {
    setGroup(selectableValue.value);
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

  const absoluteScaleX = d3
    .scaleTime()
    .domain([
      groupByField ? timeExtents[0] : timeRange.from.toDate(),
      groupByField ? timeExtents[1] : timeRange.to.toDate(),
    ])
    .range([0, chartWidth]);

  const scaleY = d3
    .scaleBand()
    .domain(activityLabels)
    .range([0, chartHeight]);

  const range = absoluteScaleX.domain();
  const format = graphTimeFormat(absoluteScaleX.ticks().length, range[0].valueOf(), range[1].valueOf());

  const axisX = d3.axisBottom(absoluteScaleX).tickFormat(d => dateTimeFormat(d as number, { format, timeZone }));
  const axisY = d3.axisLeft(scaleY);

  return (
    <div
      className={cx(css`
        width: ${width}px;
        height: ${height}px;
      `)}
    >
      <div>
        <svg
          className={styles.svg}
          width={width}
          height={height - (selectableGroups.length > 0 ? 40 : 0)}
          xmlns="http://www.w3.org/2000/svg"
          xmlnsXlink="http://www.w3.org/1999/xlink"
        >
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
