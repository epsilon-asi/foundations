import * as React from 'react';
import { Box, SvgIcon, Typography, useTheme, type BoxProps } from '@mui/material';
import { useControllableValue } from '../../internal/useControllableValue';
import { ChevronGlyph } from '../../internal/icons';
import { EmptyState } from '../EmptyState';
import { IconButton } from '../IconButton';

export interface TreeItemDefinition {
  id: string;
  label: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
  visible?: boolean;
  children?: readonly TreeItemDefinition[];
}
export interface TreeViewProps extends Omit<BoxProps, 'onSelect'> {
  'aria-label': string;
  items: readonly TreeItemDefinition[];
  expandedIds?: readonly string[];
  defaultExpandedIds?: readonly string[];
  onExpandedChange?: (ids: string[]) => void;
  selectedIds?: readonly string[];
  defaultSelectedIds?: readonly string[];
  onSelectionChange?: (ids: string[], item: TreeItemDefinition) => void;
  onItemActivate?: (item: TreeItemDefinition) => void;
  onVisibilityChange?: (visible: boolean, item: TreeItemDefinition) => void;
  getVisibilityLabel?: (item: TreeItemDefinition) => string;
  multiSelect?: boolean;
  disabled?: boolean;
  emptyState?: React.ReactNode;
}
type VisibleItem = { item: TreeItemDefinition; parent?: string; level: number; disabled: boolean };
export const TreeView = React.forwardRef<HTMLUListElement, TreeViewProps>(function TreeView(
  { items, expandedIds, defaultExpandedIds = [], onExpandedChange, selectedIds, defaultSelectedIds = [], onSelectionChange,
    onItemActivate, onVisibilityChange, getVisibilityLabel = item => `${item.label} visibility`, multiSelect = false, disabled = false, emptyState, sx, onKeyDown, ...props }, ref
) {
  const theme = useTheme(); const root = React.useRef<HTMLUListElement>(null); const treeId = React.useId();
  React.useImperativeHandle(ref, () => root.current!);
  const [expanded, setExpanded] = useControllableValue(expandedIds, defaultExpandedIds);
  const [selected, setSelected] = useControllableValue(selectedIds, defaultSelectedIds);
  const [focused, setFocused] = React.useState<string>(); const nodes = React.useRef(new Map<string, HTMLLIElement>());
  const ancestors = React.useRef<string[]>([]);
  const search = React.useRef({ value: '', time: 0 }); const visible: VisibleItem[] = [];
  const walk = (entries: readonly TreeItemDefinition[], level: number, parent?: string, unavailable = disabled) => {
    for (const item of entries) { const off = unavailable || !!item.disabled; visible.push({ item, level, parent, disabled: off });
      if (expanded.includes(item.id)) walk(item.children ?? [], level + 1, item.id, off);
    }
  }; walk(items, 1);
  const enabled = visible.filter(entry => !entry.disabled);
  const tabId = enabled.some(entry => entry.item.id === focused) ? focused : ancestors.current.find(id => enabled.some(entry => entry.item.id === id))
    ?? enabled.find(entry => selected.includes(entry.item.id))?.item.id ?? enabled[0]?.item.id;
  React.useLayoutEffect(() => {
    // Preserve focus when a controlled collapse/removal hides the active descendant.
    const active = root.current?.ownerDocument.activeElement;
    if (focused && !enabled.some(entry => entry.item.id === focused) && (active === root.current?.ownerDocument.body || root.current?.contains(active ?? null))) {
      if (tabId) nodes.current.get(tabId)?.focus(); else root.current?.focus();
    }
  }, [tabId, focused, items, expanded, disabled]);
  const focus = (id?: string) => { if (id) { setFocused(id); nodes.current.get(id)?.focus(); } };
  const toggle = (item: TreeItemDefinition, open = !expanded.includes(item.id)) => {
    const next = open ? [...new Set([...expanded, item.id])] : expanded.filter(id => id !== item.id);
    setExpanded(next); onExpandedChange?.(next);
  };
  const select = (item: TreeItemDefinition, additive = false) => {
    const next = multiSelect && additive ? selected.includes(item.id) ? selected.filter(id => id !== item.id) : [...selected, item.id] : [item.id];
    setSelected(next); onSelectionChange?.(next, item);
  };
  const render = (entries: readonly TreeItemDefinition[], level = 1, unavailable = disabled): React.ReactNode => entries.map((item, index) => {
    const off = unavailable || !!item.disabled; const branch = !!item.children?.length; const open = expanded.includes(item.id);
    return <Box component="li" key={item.id} ref={(node: HTMLLIElement | null) => { if (node) nodes.current.set(item.id, node); else nodes.current.delete(item.id); }}
      role="treeitem" aria-label={item.label} aria-describedby={item.description != null ? `${treeId}-${encodeURIComponent(item.id)}-description` : undefined} aria-level={level} aria-posinset={index + 1} aria-setsize={entries.length}
      aria-expanded={branch ? open : undefined} aria-selected={selected.includes(item.id)} aria-disabled={off || undefined}
      tabIndex={!off && tabId === item.id ? 0 : -1} onFocus={event => { if (event.target === event.currentTarget) {
        setFocused(item.id); const parents: string[] = []; let current = visible.find(entry => entry.item.id === item.id);
        while (current?.parent) { parents.push(current.parent); current = visible.find(entry => entry.item.id === current?.parent); }
        ancestors.current = parents;
      } }}
      onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        onKeyDown?.(event as unknown as React.KeyboardEvent<HTMLDivElement>); if (off || event.defaultPrevented) return;
        const position = enabled.findIndex(entry => entry.item.id === item.id); const current = enabled[position];
        const forward = theme.direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight'; const back = theme.direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
        if (['ArrowDown', 'ArrowUp', 'Home', 'End', forward, back, 'Enter', ' '].includes(event.key)) event.preventDefault();
        if (event.key === 'ArrowDown') focus(enabled[Math.min(enabled.length - 1, position + 1)]?.item.id);
        else if (event.key === 'ArrowUp') focus(enabled[Math.max(0, position - 1)]?.item.id);
        else if (event.key === 'Home') focus(enabled[0]?.item.id);
        else if (event.key === 'End') focus(enabled.at(-1)?.item.id);
        else if (event.key === forward && branch) { if (!open) toggle(item, true); else if (enabled[position + 1]?.level > level) focus(enabled[position + 1]?.item.id); }
        else if (event.key === back) { if (branch && open) toggle(item, false); else focus(current?.parent); }
        else if (event.key === 'Enter') { select(item, event.ctrlKey || event.metaKey); onItemActivate?.(item); }
        else if (event.key === ' ') select(item, multiSelect);
        else if (multiSelect && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') { event.preventDefault(); const next = enabled.map(entry => entry.item.id); setSelected(next); onSelectionChange?.(next, item); }
        else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          const time = Date.now(); const text = event.key.toLocaleLowerCase(); const previous = time - search.current.time < 600 ? search.current.value : '';
          search.current = { value: previous + text, time }; const query = [...new Set(search.current.value)].length === 1 ? text : search.current.value;
          const ordered = [...enabled.slice(position + 1), ...enabled.slice(0, position + 1)]; focus(ordered.find(entry => entry.item.label.toLocaleLowerCase().startsWith(query))?.item.id);
        }
      }} sx={{ listStyle: 'none', outline: 0, minWidth: 0, '&:focus-visible > [data-tree-row]': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 } }}>
      <Box data-tree-row="" onClick={event => { if (off) return; focus(item.id); select(item, event.ctrlKey || event.metaKey); }}
        onDoubleClick={() => { if (off) return; if (branch) toggle(item); onItemActivate?.(item); }}
        sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 32, paddingInlineStart: `${8 + (level - 1) * 16}px`, paddingInlineEnd: 2,
          py: 1, minWidth: 0, borderRadius: 0.75, cursor: off ? 'default' : 'pointer', opacity: off ? 0.5 : 1,
          bgcolor: selected.includes(item.id) ? 'action.selected' : undefined, '&:hover': { bgcolor: off ? undefined : 'action.hover' } }}>
        <Box component="span" aria-hidden="true" onClick={event => { if (!branch) return; event.stopPropagation(); if (!off) { focus(item.id); toggle(item); } }}
          sx={{ display: 'flex', width: 24, height: 24, flexShrink: 0, alignItems: 'center', justifyContent: 'center' }}>
          {branch ? <ChevronGlyph fontSize="small" sx={{ transform: open ? 'none' : theme.direction === 'rtl' ? 'rotate(90deg)' : 'rotate(-90deg)' }} /> : null}
        </Box>
        {item.icon != null ? <Box component="span" aria-hidden="true" sx={{ display: 'flex', flexShrink: 0 }}>{item.icon}</Box> : null}
        <Box sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}><Typography variant="body2">{item.label}</Typography>
          {item.description != null ? <Typography id={`${treeId}-${encodeURIComponent(item.id)}-description`} variant="caption" color="text.secondary">{item.description}</Typography> : null}</Box>
        {onVisibilityChange && item.visible !== undefined ? <IconButton aria-label={getVisibilityLabel(item)} aria-pressed={item.visible} outlined={false}
          disabled={off} tabIndex={tabId === item.id ? 0 : -1} sx={{ flexShrink: 0 }} onClick={event => { event.stopPropagation(); onVisibilityChange(!item.visible, item); }}
          onDoubleClick={event => event.stopPropagation()} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); focus(item.id); } }}>
          <SvgIcon fontSize="small"><path d="M2 12Q6 5 12 5T22 12Q18 19 12 19T2 12Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />{!item.visible ? <path d="m3 3 18 18" stroke="currentColor" strokeWidth="2" /> : null}</SvgIcon>
        </IconButton> : null}
      </Box>
      {branch && open ? <Box component="ul" role="group" sx={{ m: 0, p: 0 }}>{render(item.children!, level + 1, off)}</Box> : null}
    </Box>;
  });
  return <Box sx={{ minWidth: 0 }}>{items.length ? null : emptyState ?? <EmptyState title="No items" />}
    <Box component="ul" ref={root} {...props} role="tree" aria-multiselectable={multiSelect || undefined} aria-disabled={disabled || undefined}
      tabIndex={enabled.length ? -1 : 0} sx={[{ m: 0, p: 0, minWidth: 0, listStyle: 'none' }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>{render(items)}</Box>
  </Box>;
});
