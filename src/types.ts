type SortBy = 'text' | 'startTime';
type SortOrder = 'asc' | 'desc';

export interface GanttOptions {
  textField?: string;
  startField?: string;
  endField?: string;
  groupByField?: string;
  labelFields: string[];
  sortBy: SortBy;
  sortOrder: SortOrder;

  experiments: {
    enabled: boolean;
    lockToExtents: boolean;
    relativeXAxis: boolean;
  };
}
