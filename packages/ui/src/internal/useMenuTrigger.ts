import * as React from 'react';
import type { MenuCloseReason } from '../components/Menu';

export function useMenuTrigger<T extends HTMLElement>(id: string | undefined, onClose?: (reason: MenuCloseReason) => void) {
  const generatedId = React.useId();
  const triggerId = id ?? `${generatedId}-trigger`;
  const menuId = `${generatedId}-menu`;
  const [anchorEl, setAnchorEl] = React.useState<T | null>(null);
  const open = anchorEl !== null;

  const handleClose = (reason: MenuCloseReason) => {
    setAnchorEl(null);
    onClose?.(reason);
  };

  const handleKeyDown = (event: React.KeyboardEvent<T>) => {
    if (event.key === 'ArrowDown' && !event.defaultPrevented) {
      event.preventDefault();
      setAnchorEl(event.currentTarget);
    }
  };

  return {
    anchorEl, open, menuId, triggerId, handleClose, handleKeyDown,
    // ButtonBase prevents the default action before dispatching a keyboard-generated click.
    handleOpen: (event: React.MouseEvent<T>) => {
      if (event.type !== 'click' || !event.defaultPrevented) setAnchorEl(event.currentTarget);
    },
    accessibilityProps: {
      id: triggerId,
      'aria-haspopup': 'menu' as const,
      'aria-expanded': open,
      'aria-controls': open ? menuId : undefined
    }
  };
}
