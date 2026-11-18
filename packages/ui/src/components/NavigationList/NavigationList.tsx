import * as React from 'react';
import { Box, Link, SvgIcon, Typography, type BoxProps } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { LinkRenderer, LinkRenderProps } from '../../internal/links';
import { ActionButton } from '../ActionButton';
import { IconButton } from '../IconButton';

interface NavigationBase {
  id: string;
  label: React.ReactNode;
  disabled?: boolean;
}
export type NavigationItem = NavigationBase & ({
  kind: 'section';
  children: readonly NavigationItem[];
} | {
  kind?: 'item';
  href?: string;
  icon?: React.ReactNode;
  description?: React.ReactNode;
  badge?: React.ReactNode;
  disabledReason?: string;
  textValue?: string;
  children?: readonly NavigationItem[];
  onClick?: React.MouseEventHandler<HTMLElement>;
});

export interface NavigationListProps extends Omit<BoxProps<'nav'>, 'children' | 'onSelect' | 'ref'> {
  items: readonly NavigationItem[];
  value?: string | null;
  onSelect?: (item: NavigationItem, event: React.MouseEvent<HTMLElement>) => void;
  expandedIds?: readonly string[];
  defaultExpandedIds?: readonly string[];
  onExpandedChange?: (ids: string[], event: React.SyntheticEvent) => void;
  renderLink?: LinkRenderer;
  density?: 'compact' | 'comfortable';
  disabled?: boolean;
  title?: string;
  emptyState?: React.ReactNode;
}

interface Row { item: NavigationItem; parents: string[]; disabled: boolean }
function flatten(items: readonly NavigationItem[], parents: string[] = [], disabled = false): Row[] {
  return items.flatMap((item) => [{ item, parents, disabled: disabled || !!item.disabled },
    ...flatten(item.children ?? [], [...parents, item.id], disabled || !!item.disabled)]);
}
const EMPTY_IDS: readonly string[] = [];

/** Native navigation and disclosure semantics; routing and selected-page state are application-owned. */
export const NavigationList = React.forwardRef<HTMLElement, NavigationListProps>(function NavigationList(
  { items, value = null, onSelect, expandedIds, defaultExpandedIds = EMPTY_IDS, onExpandedChange, renderLink,
    density = 'compact', disabled = false, title, emptyState = 'No navigation items', sx, dir,
    onKeyDown, onFocusCapture, onBlurCapture, 'aria-label': label = 'Navigation', ...props }, ref
) {
  const id = React.useId();
  const theme = useTheme();
  const direction = dir ?? theme.direction;
  const root = React.useRef<HTMLElement>(null);
  const rows = React.useMemo(() => flatten(items, [], disabled), [items, disabled]);
  const byId = new Map(rows.map((row) => [row.item.id, row]));
  const activeParents = (byId.get(value ?? '')?.parents ?? []).filter((parent) => byId.get(parent)?.item.kind !== 'section');
  const ancestorKey = JSON.stringify(activeParents);
  const [internalExpanded, setExpanded] = React.useState<string[]>(() => [...new Set([...defaultExpandedIds, ...activeParents])]);
  const expanded = new Set(expandedIds ?? internalExpanded);
  const visible = rows.filter((row) => row.item.kind !== 'section' && !row.disabled
    && row.parents.every((parent) => byId.get(parent)?.item.kind === 'section' || expanded.has(parent)));
  const lastFocus = React.useRef<{ id: string; element: HTMLElement; parents: string[] } | null>(null);
  const typeahead = React.useRef({ text: '', at: 0 });
  React.useImperativeHandle(ref, () => root.current!);
  React.useEffect(() => {
    if (expandedIds === undefined) setExpanded((previous) => [...new Set([...previous, ...JSON.parse(ancestorKey) as string[]])]);
  }, [ancestorKey, expandedIds]);

  const primaryId = (itemId: string) => `${id}-item-${encodeURIComponent(itemId)}`;
  const groupId = (itemId: string) => `${id}-group-${encodeURIComponent(itemId)}`;
  const primary = (itemId: string) => {
    const node = root.current?.ownerDocument.getElementById(primaryId(itemId));
    return node && root.current?.contains(node) ? node : null;
  };
  React.useLayoutEffect(() => {
    const focused = lastFocus.current;
    if (!focused) return;
    const available = visible.some((row) => row.item.id === focused.id);
    if (available && root.current?.contains(focused.element) && !focused.element.closest('[hidden]')) return;
    const destination = available ? focused.id : [...focused.parents].reverse().find((parent) => visible.some((row) => row.item.id === parent)) ?? visible[0]?.item.id;
    (destination ? primary(destination) : root.current)?.focus();
  });

  const toggle = (itemId: string, event: React.SyntheticEvent) => {
    const next = new Set(expanded);
    if (!next.delete(itemId)) next.add(itemId);
    const ids = [...next];
    if (expandedIds === undefined) setExpanded(ids);
    onExpandedChange?.(ids, event);
  };

  const renderItems = (source: readonly NavigationItem[], inheritedDisabled: boolean): React.ReactNode => source.map((item) => {
    const unavailable = inheritedDisabled || !!item.disabled;
    if (item.kind === 'section') return <Box component="li" key={item.id} sx={{ listStyle: 'none', minWidth: 0, mt: 1.5 }}>
      <Typography id={primaryId(item.id)} component="h3" variant="overline" color="text.secondary" sx={{ px: 1.25, mb: 0.5 }}>{item.label}</Typography>
      <Box component="ul" aria-labelledby={primaryId(item.id)} sx={{ listStyle: 'none', m: 0, p: 0 }}>{renderItems(item.children, unavailable)}</Box>
    </Box>;
    const hasChildren = !!item.children?.length;
    const open = hasChildren && expanded.has(item.id);
    const toggleOnly = hasChildren && !item.href && !item.onClick;
    const active = value === item.id;
    const click: React.MouseEventHandler<HTMLElement> = (event) => {
      if (unavailable) { event.preventDefault(); return; }
      if (toggleOnly) { toggle(item.id, event); return; }
      item.onClick?.(event);
      if (!event.defaultPrevented) onSelect?.(item, event);
    };
    const content = <>
      {item.icon != null ? <Box component="span" aria-hidden sx={{ display: 'flex', flexShrink: 0, '& > svg': { fontSize: 20 } }}>{item.icon}</Box> : null}
      <Box component="span" sx={{ flex: 1, minWidth: 0 }}>
        <Typography component="span" variant="body2" sx={{ display: 'block', fontWeight: active || activeParents.includes(item.id) ? 700 : 500 }}>{item.label}</Typography>
        {item.description != null ? <Typography component="span" variant="caption" color={unavailable ? 'text.disabled' : 'text.secondary'} sx={{ display: 'block' }}>{item.description}</Typography> : null}
      </Box>
      {item.badge != null ? <Box component="span" sx={{ flexShrink: 0 }}>{item.badge}</Box> : null}
      {toggleOnly ? <SvgIcon fontSize="small" aria-hidden sx={{ flexShrink: 0, transform: open ? 'rotate(90deg)' : direction === 'rtl' ? 'rotate(180deg)' : undefined }}><path d="m9 5 7 7-7 7Z" /></SvgIcon> : null}
    </>;
    const shared = { id: primaryId(item.id), 'data-navigation-primary': item.id,
      'aria-current': active && !toggleOnly ? 'page' as const : undefined,
      'aria-expanded': toggleOnly ? open : undefined, 'aria-controls': toggleOnly ? groupId(item.id) : undefined,
      'aria-description': unavailable ? item.disabledReason : undefined, onClick: click };
    const padding = density === 'compact' ? '6px 10px' : '9px 10px';
    const linkProps: LinkRenderProps | null = item.href ? { ...shared, href: item.href, children: content,
      style: { display: 'flex', alignItems: 'center', width: '100%', boxSizing: 'border-box', minWidth: 0,
        gap: 10, padding, textDecoration: 'none', color: 'inherit', borderRadius: 'inherit' } } : null;
    return <Box component="li" key={item.id} sx={{ listStyle: 'none', minWidth: 0, my: 0.25 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0, borderRadius: 1,
        color: unavailable ? 'text.disabled' : 'text.primary',
        bgcolor: active ? 'action.selected' : undefined,
        '&:hover': { bgcolor: unavailable ? undefined : 'action.hover' },
        '& [data-navigation-primary]:focus-visible, & [data-navigation-primary].Mui-focusVisible': {
          outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2
        } }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {linkProps && !unavailable ? (renderLink ? renderLink(linkProps) : <Link {...linkProps} />)
            : linkProps ? <Box component="span" id={shared.id} aria-disabled="true" aria-description={item.disabledReason}
              sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: padding }}>{content}</Box>
              : <ActionButton {...shared} disabled={unavailable} variant="text" color="inherit"
                sx={{ width: '100%', justifyContent: 'flex-start', textAlign: 'start', gap: 1.25, p: padding, borderRadius: 'inherit' }}>{content}</ActionButton>}
        </Box>
        {hasChildren && !toggleOnly ? <IconButton aria-label={`${open ? 'Collapse' : 'Expand'} ${item.textValue ?? (typeof item.label === 'string' ? item.label : item.id)}`}
          data-navigation-toggle={item.id} aria-expanded={open} aria-controls={groupId(item.id)} outlined={false} size="small" disabled={unavailable}
          onClick={(event) => toggle(item.id, event)} sx={{ flexShrink: 0 }}>
          <SvgIcon fontSize="small" sx={{ transform: open ? 'rotate(90deg)' : direction === 'rtl' ? 'rotate(180deg)' : undefined }}><path d="m9 5 7 7-7 7Z" /></SvgIcon>
        </IconButton> : null}
      </Box>
      {hasChildren ? <Box component="ul" id={groupId(item.id)} hidden={!open}
        sx={{ listStyle: 'none', m: 0, p: 0, marginInlineStart: 1.5, paddingInlineStart: 1, borderInlineStart: 1, borderColor: 'divider' }}>
        {renderItems(item.children!, unavailable)}
      </Box> : null}
    </Box>;
  });

  return <Box component="nav" ref={root} tabIndex={-1} data-navigation-root dir={direction} aria-label={label} {...props}
    sx={[{ minWidth: 0, width: '100%', overflowWrap: 'anywhere' }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
    onFocusCapture={(event: React.FocusEvent<HTMLElement>) => {
      onFocusCapture?.(event);
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-navigation-primary], [data-navigation-toggle]');
      if (!target || target.closest('[data-navigation-root]') !== root.current) return;
      const itemId = target.dataset.navigationPrimary ?? target.dataset.navigationToggle!;
      lastFocus.current = { id: itemId, element: target, parents: byId.get(itemId)?.parents ?? [] };
    }}
    onBlurCapture={(event: React.FocusEvent<HTMLElement>) => {
      onBlurCapture?.(event);
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) lastFocus.current = null;
    }}
    onKeyDown={(event: React.KeyboardEvent<HTMLElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      const control = (event.target as HTMLElement).closest<HTMLElement>('[data-navigation-primary]');
      if (!control || control.closest('[data-navigation-root]') !== root.current) return;
      const index = visible.findIndex((row) => row.item.id === control.dataset.navigationPrimary);
      const row = visible[index];
      if (!row) return;
      let destination: string | undefined;
      if (event.key === 'ArrowDown') destination = visible[(index + 1) % visible.length]?.item.id;
      else if (event.key === 'ArrowUp') destination = visible[(index + visible.length - 1) % visible.length]?.item.id;
      else if (event.key === 'Home') destination = visible[0]?.item.id;
      else if (event.key === 'End') destination = visible.at(-1)?.item.id;
      else if (event.key === (direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight') && row.item.children?.length) {
        if (!expanded.has(row.item.id)) toggle(row.item.id, event);
        else destination = visible.find((child) => child.parents.includes(row.item.id))?.item.id;
        event.preventDefault();
      } else if (event.key === (direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft')) {
        if (row.item.children?.length && expanded.has(row.item.id)) toggle(row.item.id, event);
        else destination = [...row.parents].reverse().find((parent) => visible.some((candidate) => candidate.item.id === parent));
        if (destination || row.item.children?.length) event.preventDefault();
      } else if (event.key.length === 1 && event.key !== ' ') {
        const now = Date.now();
        const text = (now - typeahead.current.at < 500 ? typeahead.current.text : '') + event.key.toLocaleLowerCase();
        typeahead.current = { text, at: now };
        const needle = [...text].every((character) => character === text[0]) ? text[0] : text;
        const match = [...visible.slice(index + 1), ...visible.slice(0, index + 1)].find(({ item }) =>
          (item.kind === 'section' ? '' : item.textValue ?? (typeof item.label === 'string' ? item.label : item.id)).toLocaleLowerCase().startsWith(needle));
        destination = match?.item.id;
      }
      if (destination) { event.preventDefault(); primary(destination)?.focus(); }
    }}>
    {title ? <Typography component="h2" variant="overline" color="text.secondary" sx={{ px: 1.25 }}>{title}</Typography> : null}
    <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
      {items.length === 0 ? <Box component="li" sx={{ p: 1.25, color: 'text.secondary', typography: 'body2' }}>{emptyState}</Box> : renderItems(items, disabled)}
    </Box>
  </Box>;
});
