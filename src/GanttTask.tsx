import { Field, GrafanaTheme, LinkModel } from '@grafana/data';
import { ContextMenu, MenuItemsGroup, stylesFactory, useTheme } from '@grafana/ui';
import Tippy from '@tippyjs/react';
import { css } from 'emotion';
import React, { useState } from 'react';

interface Props {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  tooltip: React.ReactNode;
  links: Array<LinkModel<Field>>;
}

export const GanttTask = ({ x, y, width, height, color, tooltip, links }: Props) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [contextMenuLabel, setContextMenuLabel] = useState<React.ReactNode | string>('');
  const [contextMenuGroups, setContextMenuGroups] = useState<MenuItemsGroup[]>([]);
  const [showContextMenu, setShowContextMenu] = useState(false);

  return (
    <>
      {showContextMenu &&
        renderContextMenu(contextMenuPos, contextMenuLabel, contextMenuGroups, () => setShowContextMenu(false))}
      <Tippy maxWidth={500} content={tooltip} placement="bottom" animation={false} className={styles.tooltip}>
        <g
          className={css`
            cursor: pointer;
          `}
          onClick={(e) => {
            setContextMenuPos({ x: e.clientX, y: e.clientY });
            setShowContextMenu(true);
            setContextMenuLabel(
              <div
                className={css`
                  padding: ${theme.spacing.xs} ${theme.spacing.sm};
                `}
              >
                {tooltip}
              </div>
            );
            setContextMenuGroups([
              {
                items: links.map((link) => {
                  return {
                    label: link.title,
                    url: link.href,
                    target: link.target,
                    icon: link.target === '_self' ? 'link' : 'external-link-alt',
                    onClick: link.onClick,
                  };
                }) as any,
              },
            ]);
          }}
        >
          <rect
            fill={color}
            x={x}
            y={y}
            width={width}
            height={height}
            rx={theme.border.radius.sm}
            ry={theme.border.radius.sm}
          />
        </g>
      </Tippy>
    </>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    tooltip: css`
      border-radius: ${theme.border.radius.md};
      background-color: ${theme.colors.bg2};
      padding: ${theme.spacing.sm};
      box-shadow: 0px 0px 20px ${theme.colors.dropdownShadow};
    `,
  };
});

const renderContextMenu = (
  pos: { x: number; y: number },
  label: React.ReactNode | string,
  items: MenuItemsGroup[],
  onClose: () => void
) => {
  const contextContentProps = {
    x: pos.x,
    y: pos.y,
    onClose,
    items,
    renderHeader: () => label,
  };

  return <ContextMenu {...contextContentProps} />;
};
