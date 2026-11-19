import * as React from 'react';
import { Box, type BoxProps } from '@mui/material';
import { EmptyState } from '../EmptyState';

export interface VirtualListHandle {
  element: HTMLDivElement | null;
  scrollToIndex: (index: number, align?: 'start' | 'center' | 'end' | 'nearest') => void;
  focusIndex: (index: number) => void;
}
export interface VirtualListProps<Item> extends Omit<BoxProps, 'children' | 'height'> {
  'aria-label': string;
  items: readonly Item[];
  getItemKey: (item: Item) => string;
  renderItem: (item: Item, state: { index: number; active: boolean; disabled: boolean }) => React.ReactNode;
  /** Fixed row height in pixels. Rendered content must fit this height. */
  itemHeight?: number;
  height?: number;
  overscan?: number;
  isItemDisabled?: (item: Item) => boolean;
  onItemActivate?: (item: Item, index: number) => void;
  emptyState?: React.ReactNode;
  ref?: React.Ref<VirtualListHandle>;
}
const positive = (value: number, fallback: number, minimum: number) => Number.isFinite(value) ? Math.max(minimum, value) : fallback;
function lowerBound(values: number[], target: number) { let low = 0; let high = values.length; while (low < high) { const middle = (low + high) >>> 1; if (values[middle] < target) low = middle + 1; else high = middle; } return low; }
export function VirtualList<Item>({ items, getItemKey, renderItem, itemHeight = 32, height = 240, overscan = 3, isItemDisabled,
  onItemActivate, emptyState, ref, sx, onScroll, onKeyDown, onFocusCapture, onBlurCapture, 'aria-label': label, ...props }: VirtualListProps<Item>) {
  const root = React.useRef<HTMLDivElement>(null); const rows = React.useRef(new Map<string, HTMLLIElement>()); const id = React.useId();
  const [offset, setOffset] = React.useState(0); const [measuredHeight, setMeasuredHeight] = React.useState(0);
  const [activeKey, setActiveKey] = React.useState<string>(); const [focusedKey, setFocusedKey] = React.useState<string>();
  const focusWithin = React.useRef(false); const previousIndex = React.useRef(0); const pendingFocus = React.useRef<string | undefined>(undefined);
  const focusedElement = React.useRef<HTMLElement | null>(null);
  const rowHeight = positive(itemHeight, 32, 24); const requestedHeight = positive(height, 240, 24); const viewportHeight = measuredHeight || requestedHeight;
  const extra = Math.min(100, Math.floor(positive(overscan, 3, 0)));
  const model = React.useMemo(() => {
    const keys = items.map(getItemKey); const indices = new Map(keys.map((key, index) => [key, index]));
    const enabled = items.map((item, index) => isItemDisabled?.(item) ? -1 : index).filter(index => index >= 0);
    return { keys, indices, enabled, enabledPositions: new Map(enabled.map((index, position) => [index, position])) };
  }, [items, getItemKey, isItemDisabled]);
  const previousModel = React.useRef(model);
  const oldIndex = activeKey === undefined ? undefined : model.indices.get(activeKey);
  const activeIndex = oldIndex !== undefined && model.enabledPositions.has(oldIndex) ? oldIndex
    : model.enabled[lowerBound(model.enabled, Math.min(previousIndex.current, items.length - 1))] ?? model.enabled.at(-1) ?? -1;
  const maxOffset = Math.max(0, items.length * rowHeight - viewportHeight); const top = Math.min(maxOffset, Math.max(0, offset));
  const start = Math.max(0, Math.floor(top / rowHeight) - extra);
  const end = Math.min(items.length, Math.ceil((top + viewportHeight) / rowHeight) + extra);
  const rendered = Array.from({ length: end - start }, (_, index) => start + index);
  const focusedIndex = focusedKey === undefined ? undefined : model.indices.get(focusedKey);
  const pinnedIndex = focusWithin.current ? focusedIndex ?? activeIndex : -1;
  if (pinnedIndex >= 0 && !rendered.includes(pinnedIndex)) rendered.push(pinnedIndex);
  const candidate = model.enabled[lowerBound(model.enabled, start)];
  const tabIndex = rendered.includes(activeIndex) ? activeIndex : candidate !== undefined && candidate < end ? candidate : -1;
  const scrollToIndex = (index: number, align: 'start' | 'center' | 'end' | 'nearest' = 'nearest') => {
    if (!items.length || !Number.isFinite(index)) return;
    const at = Math.max(0, Math.min(items.length - 1, Math.floor(index))); const y = at * rowHeight;
    const current = root.current?.scrollTop ?? top;
    const next = align === 'start' ? y : align === 'center' ? y - (viewportHeight - rowHeight) / 2 : align === 'end' ? y - viewportHeight + rowHeight
      : y < current ? y : y + rowHeight > current + viewportHeight ? y + rowHeight - viewportHeight : current;
    const clamped = Math.min(maxOffset, Math.max(0, next)); if (root.current) root.current.scrollTop = clamped; setOffset(clamped);
  };
  const focusIndex = (index: number) => {
    if (!Number.isFinite(index)) return;
    const at = Math.floor(index); if (!model.enabledPositions.has(at)) return;
    const key = model.keys[at]; previousIndex.current = at; setActiveKey(key); pendingFocus.current = key; scrollToIndex(at);
    // Force a render even when the requested row was already active and visible.
    if (rows.current.has(key)) { rows.current.get(key)!.focus(); pendingFocus.current = undefined; }
  };
  React.useImperativeHandle(ref, () => ({ element: root.current, scrollToIndex, focusIndex }));
  React.useEffect(() => {
    const element = root.current; if (!element) return;
    const measure = () => { if (element.clientHeight > 0) setMeasuredHeight(element.clientHeight); };
    measure(); if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure); observer.observe(element); return () => observer.disconnect();
  }, []);
  React.useLayoutEffect(() => {
    if (previousModel.current !== model && focusWithin.current && focusedKey !== undefined) {
      const before = previousModel.current.indices.get(focusedKey); const after = model.indices.get(focusedKey);
      if (after !== undefined && model.enabledPositions.has(after) && after !== before) scrollToIndex(after);
    }
    previousModel.current = model;
    if (offset !== top) { if (root.current) root.current.scrollTop = top; setOffset(top); }
    // Repositioning an existing keyed DOM node can temporarily blur a focused child.
    if (focusWithin.current && root.current?.ownerDocument.activeElement === root.current?.ownerDocument.body && focusedElement.current?.isConnected) {
      focusedElement.current.focus({ preventScroll: true });
    }
    const pending = pendingFocus.current;
    if (pending && rows.current.has(pending)) { pendingFocus.current = undefined; rows.current.get(pending)!.focus(); }
    else if (focusWithin.current && focusedKey !== undefined && (!model.indices.has(focusedKey) || !model.enabledPositions.has(model.indices.get(focusedKey)!))) {
      if (activeIndex >= 0) {
        previousIndex.current = activeIndex; setActiveKey(model.keys[activeIndex]); rows.current.get(model.keys[activeIndex])?.focus();
      } else { setFocusedKey(undefined); root.current?.focus(); }
    }
  });
  return <Box ref={root} {...props} role="region" aria-label={label} tabIndex={tabIndex < 0 ? 0 : -1}
    onScroll={event => { onScroll?.(event); if (event.currentTarget.clientHeight > 0) setMeasuredHeight(event.currentTarget.clientHeight); setOffset(event.currentTarget.scrollTop); }}
    onFocusCapture={event => { onFocusCapture?.(event); focusWithin.current = true; }}
    onBlurCapture={event => { onBlurCapture?.(event); if (event.relatedTarget ? !event.currentTarget.contains(event.relatedTarget) : (event.target as Node).isConnected) {
      focusWithin.current = false; focusedElement.current = null; setFocusedKey(undefined);
    } }}
    onKeyDown={event => {
      onKeyDown?.(event); if (event.defaultPrevented) return;
      if (event.target !== event.currentTarget && (!(event.target instanceof HTMLElement) || !event.target.hasAttribute('data-virtual-row'))) return;
      const position = model.enabledPositions.get(activeIndex) ?? 0; const page = Math.max(1, Math.floor(viewportHeight / rowHeight));
      const delta = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : event.key === 'PageDown' ? page : event.key === 'PageUp' ? -page : 0;
      if (delta || event.key === 'Home' || event.key === 'End') {
        event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? model.enabled.length - 1 : Math.min(model.enabled.length - 1, Math.max(0, position + delta));
        if (model.enabled[next] !== undefined) focusIndex(model.enabled[next]);
      } else if (onItemActivate && activeIndex >= 0 && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onItemActivate(items[activeIndex], activeIndex); }
    }} sx={[{ height: requestedHeight, overflow: 'auto', position: 'relative', minWidth: 0, border: 1, borderColor: 'divider', borderRadius: 1,
      '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 } }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>
    {!items.length ? emptyState ?? <EmptyState title="No items" /> : null}
    <Box component="ul" role="list" sx={{ position: 'relative', height: items.length * rowHeight, m: 0, p: 0, listStyle: 'none', minWidth: 0 }}>
      {rendered.sort((a, b) => a - b).map(index => {
        const item = items[index]; const key = model.keys[index]; const off = !!isItemDisabled?.(item);
        return <Box component="li" data-virtual-row="" key={key} id={`${id}-${encodeURIComponent(key)}`} role="listitem" aria-setsize={items.length} aria-posinset={index + 1}
          aria-disabled={off || undefined} tabIndex={!off && index === tabIndex ? 0 : -1}
          ref={(node: HTMLLIElement | null) => { if (node) rows.current.set(key, node); else rows.current.delete(key); }}
          onFocusCapture={event => { focusedElement.current = event.target instanceof HTMLElement ? event.target : null; previousIndex.current = index; setActiveKey(key); setFocusedKey(key); }}
          sx={{ position: 'absolute', top: index * rowHeight, height: rowHeight, left: 0, right: 0, display: 'flex', alignItems: 'center', px: 2,
            minWidth: 0, overflow: 'hidden', opacity: off ? 0.5 : 1, '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 } }}>
          <Box sx={{ width: '100%', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', typography: 'body2' }}>{renderItem(item, { index, active: index === activeIndex, disabled: off })}</Box>
        </Box>;
      })}
    </Box>
  </Box>;
}
