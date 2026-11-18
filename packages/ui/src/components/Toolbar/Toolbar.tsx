import * as React from 'react';
import { Box, type BoxProps } from '@mui/material';
import { useTheme } from '@mui/material/styles';

export interface ToolbarProps extends BoxProps {
  orientation?: 'horizontal' | 'vertical';
  density?: 'compact' | 'comfortable';
  wrap?: boolean;
  rovingFocus?: boolean;
  endActions?: React.ReactNode;
  'aria-label'?: string;
}

const selector = 'button, a[href], [role="button"][tabindex]';

function isVisible(element: HTMLElement, root: HTMLElement | null) {
  for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) {
    const style = getComputedStyle(ancestor);
    if (ancestor.hidden || ancestor.getAttribute('aria-hidden') === 'true' || style.display === 'none' || style.visibility === 'hidden') return false;
    if (ancestor === root) break;
  }
  return true;
}

/** Arrow navigation is scoped to this toolbar; text fields and nested toolbars keep their own keys. */
export const Toolbar = React.forwardRef<HTMLDivElement, ToolbarProps>(function Toolbar(
  { children, endActions, orientation = 'horizontal', density = 'compact', wrap = true, rovingFocus = true,
    sx, onKeyDown, onFocus, 'aria-label': label, 'aria-labelledby': labelledBy, dir, ...props }, ref
) {
  const root = React.useRef<HTMLDivElement>(null);
  const active = React.useRef<HTMLElement | null>(null);
  const originals = React.useRef(new Map<HTMLElement, number>());
  const theme = useTheme();
  React.useImperativeHandle(ref, () => root.current!);
  const candidates = React.useCallback(() => [...(root.current?.querySelectorAll<HTMLElement>(selector) ?? [])].filter((element) =>
    element.closest('[role="toolbar"]') === root.current && !element.matches(':disabled, [aria-disabled="true"]')
    && isVisible(element, root.current)), []);
  const sync = React.useCallback(() => {
    const items = candidates();
    const focused = items.find((element) => element === element.ownerDocument.activeElement);
    active.current = focused ?? (items.includes(active.current!) ? active.current : items[0] ?? null);
    const owned = [...(root.current?.querySelectorAll<HTMLElement>(selector) ?? [])]
      .filter((element) => element.closest('[role="toolbar"]') === root.current);
    for (const element of owned) {
      if (!originals.current.has(element)) originals.current.set(element, element.tabIndex);
      element.tabIndex = element === active.current ? 0 : -1;
    }
    // Disabled items must not retain the previous roving tab stop (including aria-disabled links).
    for (const [element] of originals.current) {
      if (!root.current?.contains(element)) {
        element.tabIndex = originals.current.get(element)!;
        originals.current.delete(element);
      } else if (!owned.includes(element)) {
        element.tabIndex = originals.current.get(element)!;
        originals.current.delete(element);
      }
    }
  }, [candidates]);
  React.useEffect(() => {
    if (!rovingFocus) return;
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root.current!, { childList: true, subtree: true, attributes: true,
      attributeFilter: ['disabled', 'aria-disabled', 'hidden', 'aria-hidden', 'style', 'class'] });
    const kept = originals.current;
    return () => { observer.disconnect(); for (const [element, tabIndex] of kept) element.tabIndex = tabIndex; kept.clear(); };
  }, [rovingFocus, sync]);
  return <Box ref={root} role="toolbar" aria-orientation={orientation} aria-label={label ?? (labelledBy ? undefined : 'Actions')}
    aria-labelledby={labelledBy} dir={dir ?? theme.direction} {...props}
    sx={[{ display: 'flex', flexDirection: orientation === 'vertical' ? 'column' : 'row',
      flexWrap: wrap ? 'wrap' : 'nowrap', alignItems: orientation === 'vertical' ? 'stretch' : 'center',
      gap: density === 'compact' ? 0.5 : 1, p: density === 'compact' ? 1 : 1.5, minWidth: 0,
      overflow: wrap ? undefined : 'auto', border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' },
      ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
    onFocus={(event) => { onFocus?.(event); if (rovingFocus) sync(); }}
    onKeyDown={(event) => {
      onKeyDown?.(event);
      if (!rovingFocus || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable="true"]') || target.closest('[role="toolbar"]') !== root.current) return;
      const items = candidates();
      const index = items.findIndex((item) => item === target || item.contains(target));
      if (index < 0) return;
      const rtl = (dir ?? theme.direction) === 'rtl';
      const next = orientation === 'horizontal' ? (rtl ? 'ArrowLeft' : 'ArrowRight') : 'ArrowDown';
      const previous = orientation === 'horizontal' ? (rtl ? 'ArrowRight' : 'ArrowLeft') : 'ArrowUp';
      let destination: number;
      if (event.key === 'Home') destination = 0;
      else if (event.key === 'End') destination = items.length - 1;
      else if (event.key === next) destination = (index + 1) % items.length;
      else if (event.key === previous) destination = (index + items.length - 1) % items.length;
      else return;
      event.preventDefault();
      items[destination]?.focus();
    }}>{children}{endActions != null ? <Box sx={{ minWidth: 0, display: 'flex', flexWrap: wrap ? 'wrap' : 'nowrap', gap: 1,
      ...(orientation === 'horizontal' ? { marginInlineStart: 'auto' } : { mt: 'auto' }) }}>{endActions}</Box> : null}</Box>;
});

export interface ToolbarGroupProps extends BoxProps {
  divided?: boolean;
  orientation?: 'horizontal' | 'vertical';
}

export const ToolbarGroup = React.forwardRef<HTMLDivElement, ToolbarGroupProps>(function ToolbarGroup(
  { divided = false, orientation = 'horizontal', sx, ...props }, ref
) {
  return <Box ref={ref} role="group" sx={[{ display: 'flex', flexDirection: orientation === 'vertical' ? 'column' : 'row',
    alignItems: orientation === 'vertical' ? 'stretch' : 'center', flexWrap: 'wrap', gap: 0.5, minWidth: 0,
    ...(divided ? orientation === 'horizontal' ? { borderInlineStart: 1, borderColor: 'divider', paddingInlineStart: 1 }
      : { borderTop: 1, borderColor: 'divider', pt: 1 } : {}) }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]} {...props} />;
});
