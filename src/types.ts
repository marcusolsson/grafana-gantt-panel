type SortBy = 'text' | 'startTime';
type SortOrder = 'asc' | 'desc';

export interface GanttOptions {
  textField?: string;
  startField?: string;
  endField?: string;
  colorByField?: string;
  groupByField?: string;
  labelFields: string[];
  sortBy: SortBy;
  sortOrder: SortOrder;
  showYAxis: boolean;

  colors?: Array<{ text: string; color: string }>;

  experiments: {
    enabled: boolean;
    lockToExtents: boolean;
    relativeXAxis: boolean;
  };
}
