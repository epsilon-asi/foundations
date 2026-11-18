import * as React from 'react';
import { Box, Card, Typography, type CardProps, type BoxProps } from '@mui/material';
import { ActionButton } from '../ActionButton';
import { ImagePreview } from '../ImagePreview';
import { EmptyState } from '../EmptyState';
import { useControllableValue } from '../../internal/useControllableValue';

export interface AssetCardProps extends Omit<CardProps, 'title' | 'onSelect'> {
  title: string;
  description?: React.ReactNode;
  src?: string;
  alt?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onOpen?: () => void;
  openLabel?: string;
  selectionTabIndex?: number;
}
export const AssetCard = React.forwardRef<HTMLDivElement, AssetCardProps>(function AssetCard(
  { title, description, src, alt = '', badge, actions, selected = false, disabled = false, onSelect, onOpen, openLabel = 'Open',
    selectionTabIndex, sx, children, ...props }, ref
) {
  const descriptionId = React.useId();
  const content = <>
    <Box sx={{ position: 'relative' }}><ImagePreview src={src} alt={alt} aspectRatio={4 / 3} />
      {badge != null ? <Box sx={{ position: 'absolute', top: 4, insetInlineEnd: 4, maxWidth: 'calc(100% - 8px)' }}>{badge}</Box> : null}</Box>
    <Box sx={{ p: 2, minWidth: 0, overflowWrap: 'anywhere' }}><Typography component="div" variant="subtitle2">{title}</Typography>
      {description != null ? <Typography id={descriptionId} component="div" variant="caption" color="text.secondary">{description}</Typography> : null}{children}</Box>
  </>;
  return <Card ref={ref} variant="outlined" {...props} sx={[{ minWidth: 0, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column',
    borderColor: selected ? 'primary.main' : 'divider', boxShadow: selected ? theme => `0 0 0 1px ${theme.palette.primary.main}` : 'none' },
    ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>
    {onSelect ? <ActionButton data-asset-select="" aria-label={title} aria-describedby={description != null ? descriptionId : undefined} aria-pressed={selected} tabIndex={selectionTabIndex} disabled={disabled}
      color="inherit" onClick={onSelect} sx={{ display: 'block', p: 0, width: '100%', textAlign: 'start', borderRadius: 0,
        '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 } }}>{content}</ActionButton> : <Box>{content}</Box>}
    {onOpen || actions != null ? <Box component="fieldset" disabled={disabled} aria-label={`${title} actions`} sx={{ m: 0, mt: 'auto', border: 0, minWidth: 0, display: 'flex', flexWrap: 'wrap', gap: 1, p: 0, px: 2, pb: 2 }}>
      {onOpen ? <ActionButton size="small" disabled={disabled} onClick={onOpen} aria-label={`${openLabel} ${title}`}>{openLabel}</ActionButton> : null}{actions}</Box> : null}
  </Card>;
});

export interface AssetDefinition extends Pick<AssetCardProps, 'title' | 'description' | 'src' | 'alt' | 'badge' | 'disabled'> { id: string }
export interface AssetGridProps extends Omit<BoxProps, 'onSelect'> {
  'aria-label': string;
  items: readonly AssetDefinition[];
  selectedIds?: readonly string[];
  defaultSelectedIds?: readonly string[];
  onSelectionChange?: (ids: string[], item: AssetDefinition) => void;
  multiSelect?: boolean;
  onOpen?: (item: AssetDefinition) => void;
  renderActions?: (item: AssetDefinition) => React.ReactNode;
  emptyState?: React.ReactNode;
  minItemWidth?: number;
  disabled?: boolean;
}
/** A wrapping list of selectable cards; Tab reaches every card, arrows also move focus. */
export const AssetGrid = React.forwardRef<HTMLUListElement, AssetGridProps>(function AssetGrid(
  { items, selectedIds, defaultSelectedIds = [], onSelectionChange, multiSelect = false, onOpen, renderActions, emptyState,
    minItemWidth = 160, disabled = false, sx, ...props }, ref
) {
  const [selected, setSelected] = useControllableValue(selectedIds, defaultSelectedIds);
  return <Box sx={{ minWidth: 0 }}>{!items.length ? emptyState ?? <EmptyState title="No assets" description="Assets will appear here." /> : null}
    <Box component="ul" ref={ref} {...props} sx={[{ m: 0, p: 0, display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${Math.max(80, minItemWidth)}px), 1fr))`,
      gap: 2, listStyle: 'none', minWidth: 0 }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>
      {items.map(item => { const { id, ...card } = item; return <Box component="li" key={id} sx={{ minWidth: 0 }} onKeyDown={event => {
        if (!(event.target instanceof HTMLElement) || !event.target.matches('[data-asset-select]')) return;
        if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
        const buttons = Array.from(event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>('[data-asset-select]:not(:disabled)'));
        const index = buttons.indexOf(event.target as HTMLButtonElement); const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : Math.max(0, Math.min(buttons.length - 1, index + ((event.key === 'ArrowRight') !== rtl ? 1 : -1)));
        event.preventDefault(); buttons[next]?.focus();
      }}><AssetCard {...card} disabled={disabled || item.disabled} selected={selected.includes(item.id)} actions={renderActions?.(item)}
        onOpen={onOpen ? () => onOpen(item) : undefined} onSelect={event => {
          const next = multiSelect
            ? selected.includes(item.id) ? selected.filter(id => id !== item.id) : [...selected, item.id] : [item.id];
          setSelected(next); onSelectionChange?.(next, item);
        }} /></Box>; })}
    </Box>
  </Box>;
});
