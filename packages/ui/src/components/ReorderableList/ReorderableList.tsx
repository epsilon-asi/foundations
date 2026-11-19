import * as React from 'react';
import { Box, Typography, type BoxProps } from '@mui/material';
import { IconButton } from '../IconButton';
import { EmptyState } from '../EmptyState';

export interface ReorderDetails { itemId: string; fromIndex: number; toIndex: number; method: 'keyboard' | 'pointer' | 'button' }
export interface ReorderableListProps<Item> extends Omit<BoxProps, 'children' | 'onChange'> {
  'aria-label': string;
  items: readonly Item[];
  getItemId: (item: Item) => string;
  getItemLabel: (item: Item) => string;
  renderItem?: (item: Item, state: { index: number; dragging: boolean; disabled: boolean }) => React.ReactNode;
  onReorder: (items: Item[], details: ReorderDetails) => void;
  disabled?: boolean;
  /** Disabled rows retain their positions while other rows are reordered. */
  isItemDisabled?: (item: Item) => boolean;
  emptyState?: React.ReactNode;
  instructions?: string;
  getHandleLabel?: (item: Item) => string;
  getMoveLabel?: (item: Item, direction: 'up' | 'down') => string;
  getAnnouncement?: (event: { action: 'pickedUp' | 'moved' | 'dropped' | 'cancelled'; label: string; position: number; count: number }) => string;
  ref?: React.Ref<HTMLUListElement>;
}
type Transaction = { id: string; original: string[]; preview: string[]; locked: string[]; target?: string; method: 'keyboard' | 'pointer' };
function move(ids: string[], source: string, target: string, locked: string[]) {
  const movable = ids.filter(id => !locked.includes(id)); const from = movable.indexOf(source); const to = movable.indexOf(target);
  if (from < 0 || to < 0) return ids;
  movable.splice(to, 0, movable.splice(from, 1)[0]); let index = 0;
  return ids.map(id => locked.includes(id) ? id : movable[index++]);
}
const announceDefault: NonNullable<ReorderableListProps<unknown>['getAnnouncement']> = ({ action, label, position, count }) =>
  action === 'cancelled' ? `Reordering ${label} cancelled.` : `${label}: ${action === 'pickedUp' ? 'picked up' : action === 'dropped' ? 'move requested' : 'moved'}, position ${position} of ${count}.`;

/** Controlled ordering with pointer capture, cancellable previews and keyboard controls. */
export function ReorderableList<Item>({ items, getItemId, getItemLabel, renderItem, onReorder, disabled = false, isItemDisabled,
  emptyState, instructions = 'Space or Enter to pick up. Arrow keys, Home or End to move. Space or Enter to drop. Escape to cancel.',
  getHandleLabel = item => `Reorder ${getItemLabel(item)}`, getMoveLabel = (item, direction) => `Move ${getItemLabel(item)} ${direction}`,
  getAnnouncement = announceDefault, ref, sx, ...props }: ReorderableListProps<Item>) {
  const id = React.useId(); const handles = React.useRef(new Map<string, HTMLButtonElement>()); const listRoot = React.useRef<HTMLUListElement>(null);
  React.useImperativeHandle(ref, () => listRoot.current!);
  const [transaction, setTransaction] = React.useState<Transaction | null>(null); const current = React.useRef<Transaction | null>(null);
  const pointer = React.useRef<{ id: number; x: number; y: number; dragging: boolean } | null>(null);
  const ignoreClick = React.useRef(false); const clickTimer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  React.useEffect(() => () => clearTimeout(clickTimer.current), []);
  const [announcement, setAnnouncement] = React.useState('');
  const ids = items.map(getItemId); const byId = new Map(items.map(item => [getItemId(item), item]));
  const locked = items.filter(item => disabled || isItemDisabled?.(item)).map(getItemId);
  const update = (next: Transaction | null) => { current.current = next; setTransaction(next); };
  const speak = (action: Parameters<typeof getAnnouncement>[0]['action'], itemId: string, order: string[]) => {
    const item = byId.get(itemId); if (item !== undefined) setAnnouncement(getAnnouncement({ action, label: getItemLabel(item), position: order.indexOf(itemId) + 1, count: items.length }));
  };
  const cancel = (restoreFocus = true) => { const active = current.current; if (!active) return; update(null); speak('cancelled', active.id, ids); if (restoreFocus) handles.current.get(active.id)?.focus(); };
  React.useLayoutEffect(() => {
    const active = current.current;
    if (active && (active.original.length !== ids.length || active.original.some((key, index) => key !== ids[index])
      || active.locked.length !== locked.length || active.locked.some(key => !locked.includes(key)))) {
      current.current = null; pointer.current = null; setTransaction(null); setAnnouncement('Reordering cancelled because the list changed.');
      const owner = listRoot.current?.ownerDocument; const focused = owner?.activeElement;
      if (focused === owner?.body || listRoot.current?.contains(focused ?? null)) {
        const target = ids.includes(active.id) && !locked.includes(active.id) ? active.id : ids.find(key => !locked.includes(key));
        (handles.current.get(target ?? '') ?? listRoot.current)?.focus();
      }
    } else if (active?.method === 'keyboard') {
      const handle = handles.current.get(active.id); const owner = handle?.ownerDocument;
      if (owner?.activeElement === handle || owner?.activeElement === owner?.body) {
        handle?.focus({ preventScroll: true }); handle?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      }
    }
  });
  const start = (itemId: string, method: Transaction['method']) => {
    if (disabled || locked.includes(itemId)) return;
    update({ id: itemId, original: ids, preview: ids, locked, method }); speak('pickedUp', itemId, ids);
  };
  const preview = (target: string) => {
    const active = current.current; if (!active || locked.includes(target) || (active.method === 'pointer' && active.target === target)) return;
    const order = move(active.method === 'pointer' ? active.original : active.preview, active.id, target, active.locked); update({ ...active, preview: order, target }); speak('moved', active.id, order);
  };
  const commit = (order: string[], itemId: string, method: ReorderDetails['method'], original = ids) => {
    update(null); handles.current.get(itemId)?.focus(); speak('dropped', itemId, order);
    const fromIndex = original.indexOf(itemId); const toIndex = order.indexOf(itemId);
    if (fromIndex !== toIndex) onReorder(order.map(key => byId.get(key)!), { itemId, fromIndex, toIndex, method });
  };
  const pointerTarget = (x: number, y: number) => ids.find(key => {
    if (locked.includes(key)) return false; const rect = handles.current.get(key)?.closest('li')?.getBoundingClientRect();
    return rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  });
  const cancelPointer = (event: React.PointerEvent<HTMLButtonElement>) => { if (pointer.current?.id === event.pointerId) { pointer.current = null; if (current.current?.method === 'pointer') cancel(); } };
  // Never apply an obsolete preview when the caller changes the list during a drag.
  const valid = transaction && transaction.original.length === ids.length && transaction.original.every((key, index) => key === ids[index])
    && transaction.locked.length === locked.length && transaction.locked.every(key => locked.includes(key));
  // Keep pointer targets stable throughout the gesture; keyboard previews move rows.
  const order = valid && transaction.method === 'keyboard' ? transaction.preview : ids;
  return <Box sx={{ minWidth: 0, position: 'relative' }}>{!items.length ? emptyState ?? <EmptyState title="No items to reorder" /> : null}
    <Box ref={listRoot} component="ul" role="list" tabIndex={-1} {...props} sx={[{ m: 0, p: 0, listStyle: 'none', display: 'grid', gap: 1, minWidth: 0,
      '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 } }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>
      {order.map((key, index) => {
        const item = byId.get(key)!; const off = locked.includes(key); const movable = order.filter(entry => !locked.includes(entry)); const position = movable.indexOf(key);
        const dragging = valid && transaction.id === key;
        const dropTarget = valid && transaction.method === 'pointer' && transaction.target === key;
        return <Box component="li" role="listitem" key={key} aria-disabled={off || undefined}
          sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, minWidth: 0, border: 1, borderColor: dragging ? 'primary.main' : 'divider', borderRadius: 1,
            bgcolor: dragging ? 'action.selected' : dropTarget ? 'action.hover' : 'background.paper', boxShadow: dropTarget ? theme => `inset 0 2px ${theme.palette.primary.main}` : undefined }}>
          <IconButton ref={node => { if (node) handles.current.set(key, node); else handles.current.delete(key); }} aria-label={getHandleLabel(item)}
            aria-describedby={`${id}-instructions`} aria-pressed={!!dragging} disabled={off} outlined={false} draggable={false}
            sx={{ flexShrink: 0, cursor: off ? 'default' : dragging ? 'grabbing' : 'grab', touchAction: 'none' }}
            onPointerDown={event => { if (off || current.current || pointer.current || event.button !== 0 || event.isPrimary === false) return;
              clearTimeout(clickTimer.current); ignoreClick.current = false; pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, dragging: false };
              event.currentTarget.setPointerCapture?.(event.pointerId);
            }} onPointerMove={event => {
              const gesture = pointer.current; if (!gesture || gesture.id !== event.pointerId) return;
              if (!gesture.dragging) { if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) < 4) return; gesture.dragging = true; ignoreClick.current = true; start(key, 'pointer'); }
              event.preventDefault(); const target = pointerTarget(event.clientX, event.clientY);
              if (target) preview(target); else if (current.current?.target) update({ ...current.current, target: undefined, preview: current.current.original });
            }} onPointerUp={event => {
              const gesture = pointer.current; if (!gesture || gesture.id !== event.pointerId) return; pointer.current = null;
              if (gesture.dragging) { const active = current.current; const target = pointerTarget(event.clientX, event.clientY);
                if (active?.method === 'pointer' && target) commit(move(active.original, active.id, target, active.locked), active.id, 'pointer', active.original); else cancel();
                ignoreClick.current = true; clickTimer.current = setTimeout(() => { ignoreClick.current = false; }, 0);
              }
              if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
            }} onPointerCancel={cancelPointer} onLostPointerCapture={cancelPointer}
            onBlur={event => { if (event.relatedTarget && current.current?.method === 'keyboard' && current.current.id === key) cancel(false); }}
            onClick={() => { if (ignoreClick.current) { ignoreClick.current = false; return; } const active = current.current; if (active?.id === key) commit(active.preview, key, active.method, active.original); else if (!active) start(key, 'keyboard'); }}
            onKeyDown={event => {
              const active = current.current;
              if (event.key === 'Tab' && active?.method === 'keyboard') { cancel(); return; }
              if (event.key === 'Escape' && active) { event.preventDefault(); cancel(); return; }
              if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); ignoreClick.current = false; if (active?.id === key) commit(active.preview, key, active.method, active.original); else if (!active) start(key, 'keyboard'); return; }
              if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const values = (active?.preview ?? order).filter(entry => !locked.includes(entry)); const at = values.indexOf(key);
              const next = event.key === 'Home' ? 0 : event.key === 'End' ? values.length - 1 : Math.max(0, Math.min(values.length - 1, at + (event.key === 'ArrowUp' ? -1 : 1)));
              if (active?.id === key && active.method === 'keyboard') preview(values[next]); else if (!active) handles.current.get(values[next])?.focus();
            }}><Box component="span" aria-hidden="true">⠿</Box></IconButton>
          <Box sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{renderItem ? renderItem(item, { index, dragging: !!dragging, disabled: off }) : <Typography variant="body2">{getItemLabel(item)}</Typography>}</Box>
          <Box sx={{ display: 'flex', flexShrink: 0, gap: 0.5 }}>
            {(['up', 'down'] as const).map(direction => <IconButton key={direction} aria-label={getMoveLabel(item, direction)} outlined={false}
              disabled={off || !!transaction || (direction === 'up' ? position <= 0 : position >= movable.length - 1)} onClick={() => {
                const target = movable[position + (direction === 'up' ? -1 : 1)]; if (target) commit(move(order, key, target, locked), key, 'button');
              }}><Box component="span" aria-hidden="true">{direction === 'up' ? '↑' : '↓'}</Box></IconButton>)}
          </Box>
        </Box>;
      })}
    </Box>
    <Box id={`${id}-instructions`} sx={{ typography: 'caption', color: 'text.secondary', mt: 1, overflowWrap: 'anywhere' }}>{instructions}</Box>
    <Box role="status" sx={{ position: 'absolute', left: 0, top: 0, width: '1px', height: '1px', overflow: 'hidden', clipPath: 'inset(50%)' }}>{announcement}</Box>
  </Box>;
}
