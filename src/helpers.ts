// @ts-ignore
import { getColorForTheme, GrafanaTheme } from '@grafana/data';

const defaultColor = 'green';

export const labelColor = (
  label: string,
  theme: GrafanaTheme,
  colors?: Array<{ text: string; color: string }>
): string => {
  const mapping = (colors ?? []).find((col) => col.text === label);
  const color = mapping?.color ?? defaultColor;

  // Grafana 9.0.
  if (typeof theme.visualization !== 'undefined') {
    return theme.visualization.getColorByName(color);
  }

  return getColorForTheme(color, theme);
};
