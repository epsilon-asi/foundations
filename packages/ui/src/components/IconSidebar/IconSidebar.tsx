import * as React from 'react';
import { Badge, Box, ClickAwayListener, Divider, Popper, SvgIcon, type BoxProps } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { CloseIcon } from '../../internal/CloseIcon';
import { IconButton } from '../IconButton';
import { Panel } from '../Panel';
import { Toolbar } from '../Toolbar';

export interface IconSidebarItem {
  /** Unique across both items and footerItems. */
  id: string;
  label: string;
  icon: React.ReactNode;
  content: React.ReactNode;
  panelTitle?: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  /** Consecutive items with the same group share a section of the rail. */
  group?: string;
  disabled?: boolean;
  disabledReason?: string;
  badge?: React.ReactNode;
  badgeLabel?: string;
  /** Runs before selection. preventDefault() cancels the selection request. */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

export type IconSidebarChangeReason = 'itemClick' | 'keyboard' | 'closeButtonClick' | 'escapeKeyDown' | 'clickAway';
export interface IconSidebarProps extends Omit<BoxProps, 'children' | 'onChange' | 'defaultValue' | 'ref'> {
  items: readonly IconSidebarItem[];
  footerItems?: readonly IconSidebarItem[];
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (value: string | null, event: React.SyntheticEvent | Event, reason: IconSidebarChangeReason) => void;
  /** Expands the icon rail to show labels; panel selection is independent. */
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  side?: 'left' | 'right';
  panelMode?: 'overlay' | 'inline';
  panelWidth?: number;
  density?: 'compact' | 'comfortable';
  keepMounted?: boolean;
  dismissOnClickAway?: boolean;
  expandLabel?: string;
  collapseLabel?: string;
  closeLabel?: string;
}

const NO_FOOTER_ITEMS: readonly IconSidebarItem[] = [];

/** A nonmodal panel dock: our Toolbar owns rail navigation, IconButton owns buttons, and Panel owns the pane. */
export const IconSidebar = React.forwardRef<HTMLDivElement, IconSidebarProps>(function IconSidebar(
  { items, footerItems = NO_FOOTER_ITEMS, value, defaultValue = null, onChange,
    expanded, defaultExpanded = false, onExpandedChange, side = 'right', panelMode = 'overlay', panelWidth = 320,
    density = 'comfortable', keepMounted = false, dismissOnClickAway = true,
    expandLabel = 'Expand sidebar', collapseLabel = 'Collapse sidebar', closeLabel = 'Close panel',
    sx, dir, onKeyDown, 'aria-label': label = 'Panels', ...props }, ref
) {
  const id = React.useId();
  const theme = useTheme();
  const direction = dir ?? theme.direction;
  const [internalValue, setValue] = React.useState(defaultValue);
  const [internalExpanded, setExpanded] = React.useState(defaultExpanded);
  const [anchor, setAnchor] = React.useState<HTMLDivElement | null>(null);
  const [railHeight, setRailHeight] = React.useState<number | null>(null);
  const root = React.useRef<HTMLDivElement>(null);
  const rail = React.useRef<HTMLDivElement>(null);
  const panel = React.useRef<HTMLDivElement>(null);
  const expander = React.useRef<HTMLButtonElement>(null);
  const buttons = React.useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = React.useRef<{ target: 'rail' | 'panel'; id: string } | null>(null);
  const panelHadFocus = React.useRef(false);
  const updatePosition = React.useRef<(() => void) | null>(null);
  const allItems = [...items, ...footerItems];
  const selected = value === undefined ? internalValue : value;
  const active = allItems.find((item) => item.id === selected && !item.disabled);
  const previousActive = React.useRef(active?.id);
  const open = active !== undefined;
  const showLabels = expanded ?? internalExpanded;
  const iconRailWidth = density === 'compact' ? 48 : 56;
  const railWidth = showLabels ? 184 : iconRailWidth;
  const width = Number.isFinite(panelWidth) ? Math.max(160, panelWidth) : 320;
  const panelId = (itemId: string) => `${id}-panel-${encodeURIComponent(itemId)}`;
  const setRoot = React.useCallback((node: HTMLDivElement | null) => { root.current = node; setAnchor(node); }, []);
  const setPanel = React.useCallback((node: HTMLDivElement | null) => {
    panel.current = node;
    const pending = pendingFocus.current;
    // A portal can mount after the parent's layout effect has already run.
    if (node && pending?.target === 'panel' && node.id === `${id}-panel-${encodeURIComponent(pending.id)}`) {
      node.focus();
      pendingFocus.current = null;
    }
  }, [id]);
  React.useImperativeHandle(ref, () => root.current!);

  React.useLayoutEffect(() => {
    if (!anchor || panelMode !== 'overlay') return;
    const measure = () => {
      const height = anchor.getBoundingClientRect().height;
      setRailHeight(height > 0 ? height : null);
    };
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measure);
      observer.observe(anchor);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [anchor, panelMode]);

  React.useLayoutEffect(() => {
    updatePosition.current?.();
  }, [showLabels, railHeight, width, active?.id, side]);

  React.useLayoutEffect(() => {
    const pending = pendingFocus.current;
    if (pending?.target === 'panel' && active?.id === pending.id && panel.current) {
      panel.current.focus();
      pendingFocus.current = null;
    } else if (!open && (pending?.target === 'rail' || panelHadFocus.current)) {
      const trigger = buttons.current.get(pending?.id ?? selected ?? '');
      const first = allItems.find((item) => !item.disabled);
      (trigger && !trigger.disabled ? trigger : buttons.current.get(first?.id ?? '') ?? expander.current)?.focus();
      pendingFocus.current = null;
      panelHadFocus.current = false;
    } else if (active && previousActive.current !== active.id && panelHadFocus.current) {
      panel.current?.focus();
    }
    previousActive.current = active?.id;
  });

  const change = (next: string | null, event: React.SyntheticEvent | Event, reason: IconSidebarChangeReason) => {
    if (reason !== 'keyboard') {
      pendingFocus.current = next === null && active && (reason === 'escapeKeyDown' || reason === 'closeButtonClick')
        ? { target: 'rail', id: active.id } : null;
    }
    if (reason === 'clickAway') panelHadFocus.current = false;
    if (value === undefined) setValue(next);
    onChange?.(next, event, reason);
  };

  const renderItems = (source: readonly IconSidebarItem[]) => source.map((item, index) => (
    <React.Fragment key={item.id}>
      {index > 0 && item.group !== source[index - 1].group ? <Divider aria-hidden sx={{ mx: 1, my: 0.75 }} /> : null}
      <Box sx={{ px: 0.75, py: 0.25, '& > span': { width: '100%' } }}>
        <IconButton ref={(node) => { if (node) buttons.current.set(item.id, node); else buttons.current.delete(item.id); }}
          data-sidebar-item={item.id} aria-label={item.label} aria-expanded={active?.id === item.id}
          aria-controls={active?.id === item.id ? panelId(item.id) : undefined}
          aria-description={item.disabled ? item.disabledReason : item.badgeLabel}
          tooltip={item.disabledReason && item.disabled ? `${item.label}: ${item.disabledReason}` : item.label}
          disabled={item.disabled} outlined={false} grow size={density === 'compact' ? 'small' : 'medium'}
          onClick={(event) => {
            item.onClick?.(event);
            if (!event.defaultPrevented) change(active?.id === item.id ? null : item.id, event, 'itemClick');
          }}
          sx={{ position: 'relative', width: '100%', justifyContent: showLabels ? 'flex-start' : 'center',
            flexDirection: (side === 'right') !== (direction === 'rtl') ? 'row-reverse' : 'row',
            px: showLabels ? 1.25 : 0, gap: 1.5, borderRadius: '6px',
            color: active?.id === item.id ? 'primary.main' : 'text.secondary',
            bgcolor: active?.id === item.id ? 'action.selected' : 'transparent',
            '&:hover': { bgcolor: active?.id === item.id ? 'action.selected' : 'action.hover' },
            '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 },
            ...(active?.id === item.id ? { '&::before': { content: '""', position: 'absolute', width: 2, top: 8, bottom: 8,
              borderRadius: 1, bgcolor: 'primary.main', [side === 'right' ? 'left' : 'right']: 0 } } : {}) }}>
          <Badge badgeContent={item.badge} color="primary" max={99} sx={{ flexShrink: 0, '& .MuiBadge-badge': { fontSize: 9, height: 15, minWidth: 15, px: 0.5 } }}>
            <Box component="span" aria-hidden sx={{ display: 'flex', width: 22, height: 22, alignItems: 'center', justifyContent: 'center',
              '& > svg': { fontSize: density === 'compact' ? 19 : 21 } }}>{item.icon}</Box>
          </Badge>
          {showLabels ? <Box component="span" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            fontSize: 13, fontWeight: active?.id === item.id ? 600 : 500 }}>{item.label}</Box> : null}
        </IconButton>
      </Box>
    </React.Fragment>
  ));

  const pane = <Panel ref={setPanel} id={active ? panelId(active.id) : `${id}-closed`} tabIndex={-1} dir={direction}
    title={active?.panelTitle ?? active?.label ?? ''} subtitle={active?.description} footer={active?.footer} density="compact"
    headerSx={{ flexWrap: 'nowrap' }}
    headerAction={<IconButton aria-label={closeLabel} tooltip={closeLabel} size="small" outlined={false}
      onClick={(event) => change(null, event, 'closeButtonClick')}><CloseIcon /></IconButton>}
    sx={{ display: open ? 'flex' : 'none', flexDirection: 'column', width: panelMode === 'overlay' ? '100%' : width,
      maxWidth: '100%', flex: panelMode === 'inline' ? '1 1 auto' : undefined,
      minWidth: panelMode === 'inline' ? `min(160px, calc(100% - ${iconRailWidth}px))` : 0, height: '100%', borderRadius: 0,
      boxShadow: panelMode === 'overlay' ? 6 : 'none',
      '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 } }}
    contentSx={{ flex: 1, minHeight: 0, overflow: 'auto' }}
    onFocusCapture={() => { panelHadFocus.current = true; }}
    onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) panelHadFocus.current = false; }}>
    {allItems.map((item) => <Box key={item.id} hidden={active?.id !== item.id}>
      {active?.id === item.id || keepMounted ? item.content : null}
    </Box>)}
  </Panel>;

  return <ClickAwayListener onClickAway={(event) => {
    if (panelMode === 'overlay' && dismissOnClickAway && open) change(null, event, 'clickAway');
  }}>
    <Box ref={setRoot} dir={direction} {...props}
      sx={[{ position: 'relative', display: 'flex',
        flexDirection: (side === 'right') !== (direction === 'rtl') ? 'row-reverse' : 'row',
        width: panelMode === 'inline' && open ? railWidth + width : railWidth, maxWidth: '100%',
        minWidth: iconRailWidth, height: '100%', minHeight: 0, flexShrink: 0 }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.key === 'Escape' && open) {
          event.preventDefault(); event.stopPropagation(); change(null, event, 'escapeKeyDown');
        } else if (event.key === (side === 'right' ? 'ArrowLeft' : 'ArrowRight') && rail.current?.contains(event.target as Node)) {
          const trigger = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-sidebar-item]');
          const item = allItems.find((one) => one.id === trigger?.dataset.sidebarItem && !one.disabled);
          if (!item) return;
          event.preventDefault();
          if (active?.id === item.id) panel.current?.focus();
          else { pendingFocus.current = { target: 'panel', id: item.id }; change(item.id, event, 'keyboard'); }
        } else if (event.target === panel.current && event.key === (side === 'right' ? 'ArrowRight' : 'ArrowLeft')) {
          event.preventDefault(); buttons.current.get(active?.id ?? '')?.focus();
        }
      }}>
      <Toolbar ref={rail} aria-label={label} orientation="vertical" wrap={false} dir={direction}
        sx={{ width: railWidth, maxWidth: '100%', minWidth: iconRailWidth, flexShrink: panelMode === 'inline' && open ? 1 : 0,
          height: '100%', minHeight: 0, borderRadius: 0, p: 0, gap: 0, overflow: 'hidden' }}>
        <Box sx={{ p: 0.75, display: 'flex', justifyContent: 'center', flexShrink: 0, '& > span': { width: '100%' } }}>
          <IconButton ref={expander} aria-label={showLabels ? collapseLabel : expandLabel} aria-expanded={showLabels}
            tooltip={showLabels ? collapseLabel : expandLabel} outlined={false} grow size={density === 'compact' ? 'small' : 'medium'}
            onClick={() => { if (expanded === undefined) setExpanded(!showLabels); onExpandedChange?.(!showLabels); }}
            sx={{ width: '100%', borderRadius: '6px', color: 'text.secondary', gap: 1,
              '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 } }}>
            <SvgIcon fontSize="small" sx={{ transform: (side === 'right') !== showLabels ? 'rotate(180deg)' : undefined }}>
              <path d="m7 6 6 6-6 6 1.4 1.4L15.8 12 8.4 4.6ZM13 6l6 6-6 6 1.4 1.4L21.8 12l-7.4-7.4Z" />
            </SvgIcon>
            {showLabels ? <Box component="span" sx={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</Box> : null}
          </IconButton>
        </Box>
        <Divider aria-hidden />
        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', py: 0.75 }}>{renderItems(items)}</Box>
        {footerItems.length > 0 ? <Box sx={{ flexShrink: 0, maxHeight: '40%', overflowY: 'auto', overflowX: 'hidden', pb: 0.75 }}>
          <Divider aria-hidden sx={{ mx: 1, mb: 0.75 }} />{renderItems(footerItems)}
        </Box> : null}
      </Toolbar>
      {panelMode === 'inline' ? (open || keepMounted ? pane : null) : <Popper role="presentation" open={open && anchor !== null} anchorEl={anchor}
        keepMounted={keepMounted} placement={side === 'right' ? 'left-start' : 'right-start'}
        popperRef={(instance) => { updatePosition.current = instance ? () => { void instance.update(); } : null; }}
        modifiers={[{ name: 'offset', options: { offset: [0, 4] } },
          { name: 'flip', options: { fallbackPlacements: ['left-start', 'right-start'] } },
          { name: 'preventOverflow', options: { padding: 8, altAxis: true, tether: false } }]}
        sx={{ width, maxWidth: `calc(100vw - ${iconRailWidth + 24}px)`, height: railHeight ?? 'auto', maxHeight: 'calc(100dvh - 16px)',
          zIndex: theme.zIndex.drawer + 1 }}>
        {pane}
      </Popper>}
    </Box>
  </ClickAwayListener>;
});
