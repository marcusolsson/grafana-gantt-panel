import { getColorForTheme, GrafanaTheme } from '@grafana/data';

const defaultColor = 'green';

export const labelColor = (
  label: string,
  theme: GrafanaTheme,
  colors?: Array<{ text: string; color: string }>
): string => {
  const mapping = (colors ?? []).find((col) => col.text === label);
  return getColorForTheme(mapping?.color ?? defaultColor, theme);
};
