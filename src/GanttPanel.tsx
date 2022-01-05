import { FieldType, PanelProps } from '@grafana/data';
import { useTheme } from '@grafana/ui';
import { GanttChart } from 'GanttChart';
import { PanelWizard, toTimeField } from 'grafana-plugin-support';
import React from 'react';
import { GanttOptions } from './types';

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
  const theme = useTheme();

  const { colors } = options;

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
    timeZone,
    theme
  );

  const endField = toTimeField(
    options.endField
      ? frame.fields.find((f) => f.name === options.endField)
      : frame.fields.filter((f) => f !== startField).find((f) => f.type === FieldType.time),
    timeZone,
    theme
  );

  // Make sure that all fields have been configured before we continue.
  if (!textField || !startField || !endField) {
    return (
      <div style={{ width, height }}>
        <PanelWizard
          {...usage}
          fields={frame.fields.map((field) => {
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

  const colorByField = options.colorByField ? frame.fields.find((f) => f.name === options.colorByField) : textField;

  // Optional dimensions.
  const groupByField = frame.fields.find((f) => f.name === options.groupByField);
  const labelFields = options.labelFields?.map((_) => frame.fields.find((f) => f.name === _)) ?? [];

  return (
    <GanttChart
      textField={textField}
      startField={startField}
      endField={endField}
      colorByField={colorByField ?? textField}
      groupByField={groupByField}
      labelFields={labelFields}
      timeRange={timeRange}
      timeZone={timeZone}
      width={width}
      height={height}
      onChangeTimeRange={onChangeTimeRange}
      experiments={options.experiments}
      sortBy={options.sortBy}
      sortOrder={options.sortOrder}
      colors={colors}
      showYAxis={options.showYAxis}
    />
  );
};
