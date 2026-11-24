import * as React from 'react';
import { Box, ButtonBase, useMediaQuery } from '@mui/material';
import { ModalDialog, type ModalDialogProps } from '../ModalDialog';
import { SearchField } from '../SearchField';
import { ShortcutHint } from '../Keycap';
import { EmptyState } from '../EmptyState';
import { Text } from '../Text';
import { Stack } from '../Stack';
import { useControllableValue } from '../../internal/useControllableValue';
import type { Density } from '../../internal/presentation';
export interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  group?: string;
  icon?: React.ReactNode;
  shortcut?: string;
  keywords?: readonly string[];
  disabled?: boolean;
}
export interface CommandPaletteProps extends Omit<ModalDialogProps, 'title' | 'onClose' | 'onSelect'> {
  title?: React.ReactNode;
  onClose: (reason: 'escapeKeyDown' | 'backdropClick' | 'closeButtonClick' | 'itemClick') => void;
  items: readonly CommandItem[];
  onSelect: (item: CommandItem) => void;
  query?: string;
  defaultQuery?: string;
  onQueryChange?: (query: string) => void;
  filter?: (item: CommandItem, query: string) => boolean;
  loading?: boolean;
  placeholder?: string;
  emptyState?: React.ReactNode;
  footer?: React.ReactNode;
  density?: Density;
}
const matches = (item: CommandItem, q: string) =>
  [item.title, ...(item.keywords ?? [])].some((s) => s.toLowerCase().includes(q.trim().toLowerCase()));
export function CommandPalette({
  title = 'Commands',
  open,
  onClose,
  items,
  onSelect,
  query,
  defaultQuery = '',
  onQueryChange,
  filter = matches,
  loading,
  placeholder = 'Search commands',
  emptyState,
  footer,
  density,
  ...props
}: CommandPaletteProps) {
  const reduce = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [text, set] = useControllableValue(query, defaultQuery),
    [active, setActive] = React.useState<string>(),
    id = React.useId();
  const groups = React.useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    for (const item of items)
      if (filter(item, text)) {
        const key = item.group ?? '';
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(item);
      }
    return map;
  }, [items, text, filter]);
  const available = Array.from(groups.values())
      .flat()
      .filter((i) => !i.disabled),
    current = available.find((i) => i.id === active) ?? available[0];
  const optionId = (item: CommandItem) => id + '-' + encodeURIComponent(item.id);
  React.useEffect(() => {
    if (open && current) document.getElementById(optionId(current))?.scrollIntoView?.({ block: 'nearest' });
  }, [open, current?.id]);
  function select(item: CommandItem) {
    if (!loading && !item.disabled) {
      onSelect(item);
      onClose('itemClick');
    }
  }
  return (
    <ModalDialog
      {...props}
      transitionDuration={reduce ? 0 : props.transitionDuration}
      title={title}
      open={open}
      actions={footer}
      onClose={(_, reason) => {
        if (reason !== 'cancelButtonClick') onClose(reason);
      }}
    >
      <Stack density={density}>
        <SearchField
          aria-label={placeholder}
          autoFocus
          value={text}
          placeholder={placeholder}
          loading={loading}
          clearable={false}
          onChange={(v) => {
            set(v);
            onQueryChange?.(v);
            setActive(undefined);
          }}
          inputProps={{
            role: 'combobox',
            'aria-autocomplete': 'list',
            'aria-controls': id,
            'aria-expanded': open,
            'aria-activedescendant': current && !loading ? optionId(current) : undefined
          }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return;
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              onClose('escapeKeyDown');
              return;
            }
            const index = current ? available.indexOf(current) : 0;
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              if (available.length)
                setActive(
                  available[(index + (e.key === 'ArrowDown' ? 1 : -1) + available.length) % available.length].id
                );
            }
            if (e.key === 'Enter' && current) {
              e.preventDefault();
              select(current);
            }
          }}
        />
        <Box
          id={id}
          role="listbox"
          aria-label="Results"
          aria-busy={loading || undefined}
          sx={{ maxHeight: 320, overflow: 'auto' }}
        >
          {!loading &&
            Array.from(groups, ([group, entries]) => (
              <Box key={group} role="group" aria-label={group || 'Commands'}>
                {group && <Text variant="caption">{group}</Text>}
                {entries.map((item) => (
                  <ButtonBase
                    key={item.id}
                    component="div"
                    role="option"
                    tabIndex={-1}
                    id={optionId(item)}
                    aria-selected={item === current}
                    aria-disabled={item.disabled || undefined}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => {
                      if (!item.disabled) setActive(item.id);
                    }}
                    onClick={() => select(item)}
                    sx={{
                      display: 'flex',
                      minHeight: 28,
                      width: '100%',
                      textAlign: 'start',
                      justifyContent: 'flex-start',
                      px: 2,
                      py: 1,
                      gap: 2,
                      bgcolor: item === current ? 'action.selected' : undefined
                    }}
                  >
                    {item.icon}
                    <Stack gap={0} sx={{ flex: 1 }}>
                      <Text>{item.title}</Text>
                      {item.subtitle && <Text variant="caption">{item.subtitle}</Text>}
                    </Stack>
                    {item.shortcut && <ShortcutHint keys={item.shortcut.split('+')} label={item.shortcut} />}
                  </ButtonBase>
                ))}
              </Box>
            ))}
        </Box>
        {!loading && !groups.size && (emptyState ?? <EmptyState title="No matching commands" />)}
      </Stack>
    </ModalDialog>
  );
}
