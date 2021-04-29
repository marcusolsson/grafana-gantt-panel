import React from 'react';

import { FieldType, PanelProps } from '@grafana/data';
import { VizLayout, VizLegend, LegendDisplayMode, useTheme } from '@grafana/ui';

import { GanttOptions } from './types';
import { toTimeField, PanelWizard } from 'grafana-plugin-support';
import { GanttChart } from 'GanttChart';
import { labelColor } from 'helpers';

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
  onOptionsChange,
}) => {
  const theme = useTheme();
  const { colors, legendMode, legendPlacement } = options;

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

  const onColorChange = (label: string, color: string) => {
    const { colors } = options;
    onOptionsChange({
      ...options,
      colors: {
        ...colors,
        [label]: color,
      },
    });
  };

  // Find the names of all the tasks and their respective colors to create the legend items.
  const legendItems = textField.values
    .toArray()
    .map((label) => ({ label, color: labelColor(label, colors, theme), yAxis: 1 }));

  const legend = (
    <VizLegend
      items={legendItems}
      onSeriesColorChange={onColorChange}
      placement={legendPlacement ?? 'bottom'}
      displayMode={legendMode ?? LegendDisplayMode.List}
    />
  );

  return (
    <VizLayout width={width} height={height} legend={legend}>
      {(vizWidth: number, vizHeight: number) => (
        <GanttChart
          textField={textField}
          startField={startField}
          endField={endField}
          groupByField={groupByField}
          labelFields={labelFields}
          timeRange={timeRange}
          timeZone={timeZone}
          width={vizWidth}
          height={vizHeight}
          onChangeTimeRange={onChangeTimeRange}
          experiments={options.experiments}
          sortBy={options.sortBy}
          sortOrder={options.sortOrder}
          colors={colors}
        />
      )}
    </VizLayout>
  );
};
