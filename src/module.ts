import { FieldType, PanelPlugin } from '@grafana/data';
import { GanttOptions } from './types';
import { GanttPanel } from './GanttPanel';
import { FieldSelectEditor, getPanelPluginOrFallback } from 'grafana-plugin-support';
import { LegendDisplayMode } from '@grafana/ui';

export const plugin = getPanelPluginOrFallback(
  'marcusolsson-gantt-panel',
  new PanelPlugin<GanttOptions>(GanttPanel).useFieldConfig().setPanelOptions((builder) => {
    return builder
      .addRadio({
        path: 'legendMode',
        name: 'Legend mode',
        defaultValue: LegendDisplayMode.List,
        settings: {
          options: [LegendDisplayMode.List, LegendDisplayMode.Table, LegendDisplayMode.Hidden].map((mode) => ({
            label: mode[0].toUpperCase() + mode.slice(1),
            value: mode,
          })),
        },
      })
      .addRadio({
        path: 'legendPlacement',
        name: 'Legend placement',
        defaultValue: 'bottom',
        settings: {
          options: [
            { label: 'Bottom', value: 'bottom' },
            { label: 'Right', value: 'right' },
          ],
        },
      })
      .addBooleanSwitch({
        path: 'experiments.enabled',
        name: 'Enable experiments',
        description: `Try out new features that we're working on. Be aware that experiments can be unstable and may break your panel. Use at your own risk.`,
        category: ['Experiments'],
      })
      .addBooleanSwitch({
        path: 'experiments.lockToExtents',
        name: 'Lock to extents',
        description: 'Locks the view to the oldest start time and the most recent end time. This disables zooming.',
        category: ['Experiments'],
        showIf: (options) => options.experiments.enabled,
      })
      .addBooleanSwitch({
        path: 'experiments.relativeXAxis',
        name: 'Relative time',
        description: 'Displays the duration since the start of the first task.',
        category: ['Experiments'],
        showIf: (options) => options.experiments.enabled,
      })
      .addCustomEditor({
        id: 'textField',
        path: 'textField',
        name: 'Text',
        description: 'Field to use for the text. Must be unique. Defaults to the first textual field.',
        editor: FieldSelectEditor,
        category: ['Dimensions'],
        settings: {
          filterByType: [FieldType.string],
        },
      })
      .addCustomEditor({
        id: 'startField',
        path: 'startField',
        name: 'Start time',
        description: 'Field to use for the start time. Defaults to the first time field.',
        editor: FieldSelectEditor,
        category: ['Dimensions'],
        settings: {
          filterByType: [FieldType.time, FieldType.string, FieldType.number],
        },
      })
      .addRadio({
        path: 'endType',
        name: 'End type',
        description: 'Type used to determine when the task ends.',
        category: ['Dimensions'],
        defaultValue: 'time',
        settings: {
          options: [
            { label: 'Time', value: 'time' },
            { label: 'Duration', value: 'duration' },
          ],
        },
      })
      .addCustomEditor({
        id: 'endField',
        path: 'endField',
        name: 'End time',
        description: 'Field to use for the end time. Defaults to the second time field.',
        editor: FieldSelectEditor,
        category: ['Dimensions'],
        showIf: (options) => options.endType === 'time',
        settings: {
          filterByType: [FieldType.time, FieldType.string, FieldType.number],
        },
      })
      .addCustomEditor({
        id: 'duration',
        path: 'duration',
        name: 'Duration',
        description:
          'Field to use for the duration. Defaults to the first number field. The default unit is milliseconds. For other units, override the Unit for the field.',
        editor: FieldSelectEditor,
        category: ['Dimensions'],
        showIf: (options) => options.endType === 'duration',
        settings: {
          filterByType: [FieldType.number],
        },
      })
      .addCustomEditor({
        id: 'groupByField',
        path: 'groupByField',
        name: 'Group by',
        description: 'Field to use for grouping.',
        editor: FieldSelectEditor,
        category: ['Dimensions'],
        settings: {
          filterByType: [FieldType.string],
        },
      })
      .addCustomEditor({
        id: 'labelFields',
        path: 'labelFields',
        name: 'Labels',
        description: 'Fields to use as labels in the tooltip.',
        category: ['Dimensions'],
        editor: FieldSelectEditor,
        settings: {
          multi: true,
        },
      })
      .addSelect({
        path: 'sortBy',
        name: 'Sort by',
        defaultValue: 'startTime',
        settings: {
          options: [
            {
              label: 'Text',
              value: 'text',
              description: 'Sort tasks alphabetically by their text',
            },
            {
              label: 'Start time',
              value: 'startTime',
              description: 'Sort tasks chronologically by their start time',
            },
          ],
        },
      })
      .addSelect({
        path: 'sortOrder',
        name: 'Sort order',
        defaultValue: 'asc',
        settings: {
          options: [
            {
              label: 'Ascending',
              value: 'asc',
              description: 'A-Z if sorting by text, or oldest to most recent if sorting by time',
            },
            {
              label: 'Descending',
              value: 'desc',
              description: 'Z-A if sorting by text, or most recent to oldest if sorting by time',
            },
          ],
        },
      });
  })
);
