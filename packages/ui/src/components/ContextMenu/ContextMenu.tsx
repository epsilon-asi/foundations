import * as React from 'react';
import { Box, type BoxProps } from '@mui/material';
import { Menu, type MenuProps, type MenuCloseReason } from '../Menu';

export interface ContextMenuProps extends Omit<BoxProps, 'onChange'> {
  items: MenuProps['items'];
  disabled?: boolean;
  onItemClick?: MenuProps['onItemClick'];
  onOpenChange?: (open: boolean) => void;
  onClose?: (reason: MenuCloseReason) => void;
  menuProps?: Omit<MenuProps, 'open' | 'anchorEl' | 'anchorReference' | 'anchorPosition' | 'items' | 'onItemClick' | 'onClose' | 'labelledBy' | 'disableRestoreFocus'>;
}
/** A focusable context region: right-click, ContextMenu key, or Shift+F10. */
export const ContextMenu = React.forwardRef<HTMLDivElement, ContextMenuProps>(function ContextMenu(
  { items, disabled = false, onItemClick, onOpenChange, onClose, menuProps, children, onContextMenu, onKeyDown, tabIndex = 0, id, sx, ...props }, ref
) {
  const generated = React.useId(); const regionId = id ?? generated;
  const root = React.useRef<HTMLDivElement>(null); const restore = React.useRef<HTMLElement | null>(null);
  const [position, setPosition] = React.useState<{ left: number; top: number } | null>(null);
  React.useImperativeHandle(ref, () => root.current!);
  React.useEffect(() => { if (!position && restore.current) { const target = restore.current; restore.current = null; if (target.isConnected) target.focus(); } }, [position]);
  const open = (left: number, top: number) => {
    const active = root.current?.ownerDocument.activeElement;
    restore.current = active instanceof HTMLElement && root.current?.contains(active) ? active : root.current;
    setPosition({ left, top }); onOpenChange?.(true);
  };
  const close = (reason: MenuCloseReason) => { setPosition(null); onOpenChange?.(false); onClose?.(reason); };
  React.useEffect(() => { if (disabled && position) { setPosition(null); onOpenChange?.(false); } }, [disabled, position, onOpenChange]);
  return <>
    <Box ref={root} id={regionId} {...props} tabIndex={tabIndex} aria-disabled={disabled || undefined}
      sx={[{ minWidth: 0, overflowWrap: 'anywhere', '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 } }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
      onContextMenu={event => { onContextMenu?.(event); if (disabled || event.defaultPrevented) return; event.preventDefault(); open(event.clientX, event.clientY); }}
      onKeyDown={event => { onKeyDown?.(event); if (disabled || event.defaultPrevented) return;
        if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
          event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); open(rect.left + 8, rect.top + 8);
        }
      }}>{children}</Box>
    <Menu {...menuProps} open={!!position} items={items} anchorReference="anchorPosition" anchorPosition={position ?? undefined}
      labelledBy={regionId} disableRestoreFocus onItemClick={onItemClick} onClose={close} />
  </>;
});
