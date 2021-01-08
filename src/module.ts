import { FieldType, PanelPlugin } from '@grafana/data';
import { GanttOptions } from './types';
import { GanttPanel } from './GanttPanel';
import { FieldSelectEditor } from './FieldSelectEditor';

export const plugin = new PanelPlugin<GanttOptions>(GanttPanel).useFieldConfig().setPanelOptions(builder => {
  return builder
    .addCustomEditor({
      id: 'textField',
      path: 'textField',
      name: 'Text',
      description: 'Field to use for the text. Must be unique. Defaults to the first textual field.',
      editor: FieldSelectEditor,
      category: ['Dimensions'],
      settings: {
        filterByType: FieldType.string,
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
        filterByType: FieldType.time,
      },
    })
    .addCustomEditor({
      id: 'endField',
      path: 'endField',
      name: 'End time',
      description: 'Field to use for the end time. Defaults to the second time field.',
      editor: FieldSelectEditor,
      category: ['Dimensions'],
      settings: {
        filterByType: FieldType.time,
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
        filterByType: FieldType.string,
      },
    });
});