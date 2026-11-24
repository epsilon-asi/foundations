import * as React from 'react';
import { useMediaQuery } from '@mui/material';
import { ModalDialog, type ModalDialogProps } from '../ModalDialog';
import { SelectControl } from '../../internal/SelectControl';
import { ShortcutHint } from '../Keycap';
import { EmptyState } from '../EmptyState';
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
  const [text, setText] = useControllableValue(query, defaultQuery);
  const byId = React.useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const options = React.useMemo(
    () =>
      items.map((item) => ({
        value: item.id,
        label: item.title,
        description: item.subtitle,
        icon: item.icon,
        meta: item.shortcut && <ShortcutHint keys={item.shortcut} />,
        group: item.group,
        disabled: item.disabled
      })),
    [items]
  );
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
      <SelectControl
        inlineResults
        density={density}
        multiple={false}
        open={open}
        values={[]}
        options={loading ? [] : options}
        label={placeholder}
        placeholder={placeholder}
        ungroupedLabel="Commands"
        clearable={false}
        loading={loading}
        loadingText="Searching…"
        noOptionsText={emptyState ?? <EmptyState title="No matching commands" />}
        inputValue={text}
        onInputChange={(value, _, reason) => {
          if (reason === 'input') {
            setText(value);
            onQueryChange?.(value);
          }
        }}
        filterOptions={(source, input) => source.filter((option) => filter(byId.get(option.value)!, input))}
        onValuesChange={([id]) => {
          const item = byId.get(id);
          if (item && !loading && !item.disabled) {
            onSelect(item);
            onClose('itemClick');
          }
        }}
        onClose={(_, reason) => {
          if (reason === 'escape') onClose('escapeKeyDown');
        }}
      />
    </ModalDialog>
  );
}
