import { getColorForTheme, GrafanaTheme } from '@grafana/data';

const defaultColor = 'green';

export const labelColor = (label: string, colors: Record<string, string>, theme: GrafanaTheme): string => {
  const col = colors ? colors[label] : defaultColor;
  const col2 = col ?? defaultColor;
  return getColorForTheme(col2, theme);
};
