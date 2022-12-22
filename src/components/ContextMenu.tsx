import {
  ContextMenu as GrafanaContextMenu,
  MenuGroup as GrafanaMenuGroup,
  MenuItem as GrafanaMenuItem,
  MenuItemProps as GrafanaMenuItemProps,
} from '@grafana/ui';
import React from 'react';


export interface MenuGroup {
  label: string;
  items: GrafanaMenuItemProps[];
}

interface Props {
  x: number;
  y: number;
  onClose: () => void;
  renderMenuItems: () => MenuGroup[];
  renderHeader: () => React.ReactNode;
}

/**
 * ContextMenu is a wrapper for the grafana/ui ContextMenu that falls back to
 * a legacy version on earlier versions of Grafana.
 */
export const ContextMenu = ({ x, y, onClose, renderMenuItems, renderHeader }: Props) => {
    return (
      <GrafanaContextMenu
        x={x}
        y={y}
        onClose={onClose}
        renderMenuItems={() =>
          renderMenuItems().map((group, index) => (
            <GrafanaMenuGroup key={`${group.label}${index}`} label={group.label} ariaLabel={group.label}>
              {(group.items || []).map((item) => (
                <GrafanaMenuItem key={item.label} {...item} />
              ))}
            </GrafanaMenuGroup>
          ))
        }
        renderHeader={renderHeader}
      />
    );
  }
