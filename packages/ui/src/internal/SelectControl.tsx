import * as React from 'react';
import {
  Autocomplete, Box, Chip, CircularProgress, TextField, Typography, createFilterOptions,
  type PopperProps, type AutocompleteChangeReason, type AutocompleteCloseReason, type AutocompleteInputChangeReason,
  type IconButtonProps as MuiIconButtonProps
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { SearchField } from '../components/SearchField';
import { IconButton } from '../components/IconButton';
import { ListSubheader } from '../components/List';
import { CheckGlyph, ChevronGlyph } from './icons';
import { CloseIcon } from './CloseIcon';

export type SelectValue = string | number;
export type SelectChangeReason = Exclude<AutocompleteChangeReason, 'createOption'>;
export type SelectCloseReason = AutocompleteCloseReason;
export interface SelectOption<Value extends SelectValue = string> {
  value: Value;
  /** Plain text used for naming, searching and selected values. */
  label: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  meta?: React.ReactNode;
  group?: string;
  keywords?: readonly string[];
  disabled?: boolean;
  disabledReason?: string;
}
export interface SelectOptionState { selected: boolean; inputValue: string }
export interface SelectCommonProps<Value extends SelectValue> extends Omit<React.HTMLAttributes<HTMLDivElement>,
  'children' | 'defaultValue' | 'onChange' | 'ref'> {
  sx?: SxProps<Theme>;
  label: string;
  options: readonly SelectOption<Value>[];
  helperText?: React.ReactNode;
  error?: boolean;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  fullWidth?: boolean;
  size?: 'small' | 'medium';
  placeholder?: string;
  searchable?: boolean;
  clearable?: boolean;
  clearText?: string;
  openText?: string;
  closeText?: string;
  loading?: boolean;
  loadingText?: React.ReactNode;
  noOptionsText?: React.ReactNode;
  /** Native submission uses keys, never the editable search text. Multi-select repeats this name. */
  name?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  inputValue?: string;
  onInputChange?: (value: string, event: React.SyntheticEvent | null, reason: AutocompleteInputChangeReason) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpen?: (event: React.SyntheticEvent) => void;
  onClose?: (event: React.SyntheticEvent, reason: SelectCloseReason) => void;
  disablePortal?: boolean;
  ungroupedLabel?: string;
  /** Keep content noninteractive; the component owns the option element and its handlers. */
  renderOptionContent?: (option: SelectOption<Value>, state: SelectOptionState) => React.ReactNode;
  filterOptions?: (options: readonly SelectOption<Value>[], query: string) => readonly SelectOption<Value>[];
}

const IndicatorButton = React.forwardRef<HTMLButtonElement, MuiIconButtonProps>(function IndicatorButton(
  { sx, ...props }, ref
) {
  return <IconButton {...props} ref={ref} aria-label={props['aria-label'] ?? 'Select options'} outlined={false} size="small"
    sx={[{ width: 28, height: 28 }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]} />;
});
const optionKey = (value: SelectValue) => `${typeof value}:${value}`;

interface ControlProps<Value extends SelectValue> extends SelectCommonProps<Value> {
  /** Show the search field and results together inside a caller-owned surface. */
  inlineResults?: boolean;
  density?: 'compact' | 'comfortable';
  multiple: boolean;
  values: readonly Value[];
  onValuesChange: (values: Value[], event: React.SyntheticEvent, reason: SelectChangeReason) => void;
  closeOnSelect?: boolean;
  limitTags?: number;
  ref?: React.Ref<HTMLDivElement>;
}

function InlineResults({ open, children, className }: PopperProps) {
  return open ? <div className={className}>{typeof children === 'function' ? children({ placement: 'bottom' }) : children}</div> : null;
}

/** Shared combobox behaviour. Public wrappers expose single- and multi-value types separately. */
export function SelectControl<Value extends SelectValue>({
  ref, options, values, onValuesChange, multiple, inlineResults = false, density, label, helperText, error = false, required = false,
  disabled = false, readOnly = false, fullWidth = true, size = 'small', placeholder, searchable = true,
  clearable = true, clearText = 'Clear selection', openText = 'Open options', closeText = 'Close options',
  loading = false, loadingText = 'Loading options…', noOptionsText = 'No matching options', name, inputRef,
  inputValue, onInputChange, open: controlledOpen, defaultOpen = false, onOpen, onClose, disablePortal = false,
  ungroupedLabel = 'Other', renderOptionContent, filterOptions, closeOnSelect = !multiple, limitTags = -1,
  id, sx, onKeyDown, 'aria-describedby': describedBy, 'aria-label': accessibleLabel, ...props
}: ControlProps<Value>) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const helperId = helperText != null ? `${inputId}-help` : undefined;
  const [internalOpen, setOpen] = React.useState(defaultOpen);
  const open = (controlledOpen ?? internalOpen) && !disabled && !readOnly;
  const byValue = new Map(options.map((option) => [option.value, option]));
  // Keep saved values visible when an option is temporarily missing; never silently discard data.
  const selectionKey = JSON.stringify([...new Set(values)].map((value) => [value, byValue.get(value)?.label ?? String(value)]));
  // Autocomplete resets its query when its value reference changes. Recreated option objects
  // and unrelated parent renders must not erase an in-progress search.
  const selected = React.useMemo(() => [...new Set(values)].map((value) => ({ value, label: byValue.get(value)?.label ?? String(value) })), [selectionKey]);
  const selectedIcon = byValue.get(values[0])?.icon;
  const grouped = options.some((option) => option.group != null);
  const sorted = React.useMemo(() => {
    if (!grouped) return [...options];
    const groups = new Map<string, SelectOption<Value>[]>();
    for (const option of options) {
      const group = option.group ?? ungroupedLabel;
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(option);
    }
    return [...groups.values()].flat();
  }, [options, grouped, ungroupedLabel]);
  const defaultFilter = createFilterOptions<SelectOption<Value>>({
    stringify: (option) => [option.label, typeof option.description === 'string' ? option.description : '', ...(option.keywords ?? [])].join(' ')
  });
  const handleOpen = (event: React.SyntheticEvent) => {
    if (disabled || readOnly) return;
    if (controlledOpen === undefined) setOpen(true);
    onOpen?.(event);
  };
  const handleClose = (event: React.SyntheticEvent, reason: SelectCloseReason) => {
    if (controlledOpen === undefined) setOpen(false);
    onClose?.(event, reason);
  };
  return <>
    <Autocomplete<SelectOption<Value>, boolean, boolean, false>
      {...props} ref={ref} id={inputId} options={sorted} value={multiple ? selected : selected[0] ?? null}
      multiple={multiple} disabled={disabled} readOnly={readOnly} fullWidth={fullWidth} size={size}
      autoHighlight={inlineResults} forcePopupIcon={inlineResults ? false : 'auto'}
      open={open} onOpen={handleOpen} onClose={handleClose} openOnFocus={false}
      inputValue={inputValue} onInputChange={(event, query, reason) => onInputChange?.(query, event, reason)}
      disablePortal={disablePortal} disableCloseOnSelect={!closeOnSelect} disableClearable={!clearable}
      clearText={clearText} openText={openText} closeText={closeText} clearIcon={<CloseIcon />}
      popupIcon={loading ? <CircularProgress aria-label="Loading options" color="inherit" size={16} /> : <ChevronGlyph />}
      loading={loading} loadingText={<Box role="status">{loadingText}</Box>} noOptionsText={<Box role="status">{noOptionsText}</Box>}
      getOptionLabel={(option) => option.label} getOptionKey={(option) => optionKey(option.value)}
      isOptionEqualToValue={(option, value) => option.value === value.value}
      getOptionDisabled={(option) => !!option.disabled} groupBy={grouped ? (option) => option.group ?? ungroupedLabel : undefined}
      filterOptions={(source, state) => !searchable ? source : filterOptions ? [...filterOptions(source, state.inputValue)] : defaultFilter(source, state)}
      onChange={(event, next, reason, details) => {
        if (disabled || readOnly || reason === 'createOption') return;
        if (reason === 'selectOption' && details?.option.disabled) return;
        const nextValues = (Array.isArray(next) ? next : next ? [next] : []).map((option) => option.value);
        if (values.length !== nextValues.length || values.some((value, index) => value !== nextValues[index])) {
          onValuesChange(nextValues, event, reason);
        }
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.nativeEvent.isComposing || event.keyCode === 229) {
          (event as React.KeyboardEvent & { defaultMuiPrevented?: boolean }).defaultMuiPrevented = true;
          if (event.key === 'Escape') event.stopPropagation();
          return;
        }
        if (event.defaultPrevented) { (event as React.KeyboardEvent & { defaultMuiPrevented?: boolean }).defaultMuiPrevented = true; return; }
        if (!searchable && !open && !disabled && !readOnly && (event.key === ' ' || event.key === 'Enter')) {
          event.preventDefault(); handleOpen(event);
          (event as React.KeyboardEvent & { defaultMuiPrevented?: boolean }).defaultMuiPrevented = true;
        }
      }}
      limitTags={limitTags}
      renderValue={multiple ? (items, getItemProps) => (Array.isArray(items) ? items : [items]).map((option, index) => {
        const { key: _key, ...itemProps } = { ...getItemProps({ index }), key: index };
        return <Chip {...itemProps} key={optionKey(option.value)} label={option.label} size={size}
          aria-label={`Selected: ${option.label}`} sx={{ maxWidth: '100%', height: 'auto', minHeight: size === 'small' ? 24 : 32,
            '& .MuiChip-label': { whiteSpace: 'normal', overflowWrap: 'anywhere' }, '& .MuiChip-deleteIcon': { flexShrink: 0 } }} />;
      }) : undefined}
      slots={{ ...(inlineResults && { popper: InlineResults }), popupIndicator: IndicatorButton, clearIndicator: IndicatorButton }}
      slotProps={{
        popper: { sx: { maxWidth: 'calc(100vw - 16px)' } },
        paper: { ...(inlineResults && { elevation: 0 }), sx: { my: 0.75, border: 1, borderColor: 'divider', borderRadius: 1.5, overflowWrap: 'anywhere' } },
        listbox: { ...(inlineResults && { 'aria-label': label, 'aria-labelledby': undefined }), sx: { p: 0.5, maxHeight: 'min(320px, 45dvh)', '& .MuiAutocomplete-option': {
          borderRadius: 1, alignItems: 'flex-start', py: 1.25, px: 1.25, minWidth: 0, whiteSpace: 'normal', overflowWrap: 'anywhere',
          '&[aria-selected="true"]': { fontWeight: 600 }
        } } }
      }}
      renderGroup={({ key, group, children }) => <li key={key} role="presentation">
        <ListSubheader component="div" role="presentation" sx={{ px: 1.25, lineHeight: '32px', overflowWrap: 'anywhere' }}>{group}</ListSubheader>
        <Box component="ul" role="group" aria-label={group} sx={{ m: 0, p: 0, listStyle: 'none' }}>{children}</Box>
      </li>}
      renderOption={({ key: _key, ...optionProps }, option, state) => <Box component="li" {...optionProps} key={optionKey(option.value)}
        aria-label={option.label} aria-description={option.disabledReason}
        onClick={option.disabled ? (event) => { event.preventDefault(); event.stopPropagation(); } : optionProps.onClick}>
        {!inlineResults && <Box aria-hidden sx={{ width: 20, height: 20, flexShrink: 0, mr: 1.25, mt: 0.25, display: 'flex', alignItems: 'center', justifyContent: 'center',
          ...(multiple ? { border: '1px solid', borderColor: state.selected ? 'primary.main' : 'divider', borderRadius: 0.5,
            bgcolor: state.selected ? 'primary.main' : 'transparent', color: 'primary.contrastText' } : { color: 'primary.main' }) }}>
          {state.selected ? <CheckGlyph sx={{ fontSize: 18 }} /> : null}
        </Box>}
        <Box sx={{ flex: 1, minWidth: 0 }}>{renderOptionContent ? renderOptionContent(option, state) :
          <Box sx={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', columnGap: 1.25, rowGap: 0.5, minWidth: 0 }}>
            {option.icon != null ? <Box component="span" aria-hidden sx={{ display: 'flex', flexShrink: 0, mt: 0.25, '& > svg': { fontSize: 22 } }}>{option.icon}</Box> : null}
            <Box component="span" sx={{ flex: '1 1 120px', minWidth: 0 }}>
              <Typography component="span" variant="body2" sx={{ display: 'block', fontWeight: state.selected ? 600 : 500 }}>{option.label}</Typography>
              {option.description != null ? <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>{option.description}</Typography> : null}
              {option.disabledReason ? <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block' }}>{option.disabledReason}</Typography> : null}
            </Box>
            {option.meta != null ? <Box component="span" sx={{ minWidth: 0, maxWidth: '100%', display: 'inline-flex', flexWrap: 'wrap' }}>{option.meta}</Box> : null}
          </Box>}
        </Box>
      </Box>}
      renderInput={(params) => inlineResults ? (
        <SearchField aria-label={label} id={params.id} autoFocus clearable={false} clearOnEscape={false}
          density={density} value={inputValue} placeholder={placeholder} InputProps={params.InputProps}
          inputProps={params.inputProps} />
      ) : <TextField id={params.id} fullWidth={params.fullWidth} disabled={params.disabled} size={size}
        label={label} helperText={helperText} error={error} required={required} placeholder={placeholder}
        inputRef={inputRef} slotProps={{ inputLabel: params.InputLabelProps, formHelperText: { id: helperId, component: 'span' },
          input: { ...params.InputProps, startAdornment: <>{params.InputProps.startAdornment}{!multiple && selectedIcon != null ?
            <Box aria-hidden sx={{ display: 'flex', ml: 0.75, mr: 0.5, flexShrink: 0, '& > svg': { fontSize: 20 } }}>{selectedIcon}</Box> : null}</> },
          htmlInput: { ...params.inputProps, id: params.id, readOnly: readOnly || !searchable, 'aria-readonly': readOnly || undefined,
            'aria-label': accessibleLabel, 'aria-required': required || undefined, 'aria-invalid': error || undefined,
            'aria-describedby': [describedBy, helperId].filter(Boolean).join(' ') || undefined,
            'aria-busy': loading || undefined, required: required && selected.length === 0 }
        }} />}
      sx={[{ minWidth: 0, '& .MuiAutocomplete-inputRoot': { minWidth: 0 }, '& .MuiAutocomplete-input': { minWidth: '30px !important' },
        '& .MuiAutocomplete-endAdornment': { display: 'flex', alignItems: 'center' }, '& .MuiFormHelperText-root': { overflowWrap: 'anywhere' } },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
    />
    {name && (multiple ? values : [values[0] ?? '']).map((value, index) => <input key={index} type="hidden" name={name} value={value} disabled={disabled} />)}
  </>;
}
