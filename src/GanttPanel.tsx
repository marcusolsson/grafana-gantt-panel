import React, { useState } from 'react';
import { FieldType, PanelProps, dateTimeParse, DateTime, SelectableValue } from '@grafana/data';
import { GanttOptions } from 'types';
import { css, cx } from 'emotion';
import { stylesFactory, useTheme, InfoBox, Select } from '@grafana/ui';
import * as d3 from 'd3';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';

import { measureText } from './helpers';

interface Props extends PanelProps<GanttOptions> {}

export const GanttPanel: React.FC<Props> = ({ options, data, width, height, timeRange, timeZone }) => {
  const theme = useTheme();
  const styles = getStyles();

  const [group, setGroup] = useState<string>();

  const onGroupChange = (selectableValue: SelectableValue<string>) => {
    setGroup(selectableValue.value);
  };

  const frame = data.series[0];

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

  const startField = options.startField
    ? frame.fields.find(f => f.name === options.startField)
    : frame.fields.find(f => f.type === FieldType.time);

  const endField = options.endField
    ? frame.fields.find(f => f.name === options.endField)
    : frame.fields.filter(f => f !== startField).find(f => f.type === FieldType.time);

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

  const widestLabel = d3.max(activityLabels.map(measureText)) ?? 0;

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

  const axisX = d3.axisBottom(absoluteScaleX);
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

              const startTime = dateTimeParse(startField.values.get(i), { timeZone });
              const endTime = dateTimeParse(endField.values.get(i), { timeZone });

              const pixelStartX = Math.max(absoluteScaleX(startTime.toDate()), 0);
              const pixelEndX = Math.min(absoluteScaleX(endTime.toDate()), chartWidth);

              const barPadding = 2;
              const activityBarWidth = Math.max(pixelEndX - pixelStartX - 2, 1);
              const activityBarHeight = scaleY.bandwidth() - barPadding;

              const activityBarPos = {
                x: pixelStartX + padding.left,
                y: scaleY(label),
              };

              const tooltipContent = (
                <div>
                  <p>{label}</p>
                  <div>Started at: {startField.display!(startField.values.get(i)).text}</div>
                  <div>Ended at: {endField.display!(endField.values.get(i)).text}</div>
                </div>
              );

              return (
                <Tippy content={tooltipContent} key={i} placement="bottom" animation={false}>
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
          />
          <g
            transform={`translate(${padding.left}, 0)`}
            ref={node => {
              d3.select(node).call(axisY as any);
            }}
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
