import { css } from '@emotion/css';
import { Field, LinkModel } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';
import React, { useState } from 'react';
import { ContextMenu, MenuGroup } from './ContextMenu';
import { Tooltip } from './Tooltip';

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
  const theme = useTheme2().v1;

  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [contextMenuLabel, setContextMenuLabel] = useState<React.ReactNode | string>('');
  const [contextMenuGroups, setContextMenuGroups] = useState<MenuGroup[]>([]);
  const [showContextMenu, setShowContextMenu] = useState(false);

  return (
    <>
      {showContextMenu && (
        <ContextMenu
          x={contextMenuPos.x}
          y={contextMenuPos.y}
          onClose={() => setShowContextMenu(false)}
          renderHeader={() => contextMenuLabel}
          renderMenuItems={() => contextMenuGroups.filter((item) => item.items.length)}
        />
      )}
      <Tooltip content={tooltip}>
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
                label: 'Data links',
                items: links.map((link) => {
                  return {
                    label: link.title,
                    ariaLabel: link.title,
                    url: link.href,
                    target: link.target,
                    icon: link.target === '_self' ? 'link' : 'external-link-alt',
                    onClick: link.onClick,
                  };
                }),
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
      </Tooltip>
    </>
  );
};
