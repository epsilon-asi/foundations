import * as React from 'react';
import { Box, FormControl, FormControlLabel, FormHelperText, FormLabel, Radio, RadioGroup as MuiRadioGroup, Typography, type RadioGroupProps as MuiRadioGroupProps } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useControllableValue } from './useControllableValue';

export type ChoiceValue = string | number;
export interface RadioOption<Value extends ChoiceValue = string> {
  value: Value;
  label: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  meta?: React.ReactNode;
  disabled?: boolean;
}
export interface ChoiceGroupProps<Value extends ChoiceValue> extends Omit<MuiRadioGroupProps, 'value' | 'defaultValue' | 'onChange' | 'children' | 'ref'> {
  label: string;
  options: readonly RadioOption<Value>[];
  value?: Value | null;
  defaultValue?: Value | null;
  onChange?: (value: Value, event: React.SyntheticEvent) => void;
  helperText?: React.ReactNode;
  error?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  ref?: React.Ref<HTMLDivElement>;
}
export function ChoiceGroup<Value extends ChoiceValue>({ label, options, value, defaultValue = null, onChange, helperText, error = false,
  disabled = false, readOnly = false, required = false, ref, id, sx, dir, onKeyDown, onFocusCapture, onBlurCapture,
  cards = false, columns = 2, 'aria-describedby': describedBy, ...props }: ChoiceGroupProps<Value> & { cards?: boolean; columns?: 1 | 2 | 3 }) {
  const generated = React.useId(); const groupId = id ?? generated; const labelId = `${groupId}-label`; const helpId = `${groupId}-help`;
  const [selected, setSelected] = useControllableValue(value, defaultValue);
  const theme = useTheme(); const direction = dir ?? theme.direction;
  const root = React.useRef<HTMLDivElement>(null); React.useImperativeHandle(ref, () => root.current!);
  const focused = React.useRef<{ value: Value; node: HTMLInputElement } | null>(null);
  const enabled = options.map((option, index) => ({ option, index })).filter(({ option }) => !disabled && !option.disabled);
  const input = (index: number) => root.current?.querySelector<HTMLInputElement>(`input[data-choice-index="${index}"]`);
  React.useLayoutEffect(() => {
    const previous = focused.current;
    if (!previous || (root.current?.contains(previous.node) && !previous.node.disabled)) return;
    const next = enabled.find(({ option }) => option.value === selected) ?? enabled[0];
    (next ? input(next.index) : root.current)?.focus();
  });
  const choose = (option: RadioOption<Value>, event: React.SyntheticEvent) => {
    if (disabled || readOnly || option.disabled || selected === option.value) return;
    setSelected(option.value); onChange?.(option.value, event);
  };
  return <FormControl component="fieldset" error={error} disabled={disabled} required={required} sx={{ m: 0, p: 0, border: 0, minWidth: 0, width: '100%' }}>
    <FormLabel component="legend" id={labelId} sx={{ typography: 'body2', fontWeight: 600, mb: 1, overflowWrap: 'anywhere' }}>{label}</FormLabel>
    <MuiRadioGroup {...props} ref={root} id={groupId} dir={direction} aria-labelledby={labelId} aria-describedby={[describedBy, helperText != null ? helpId : undefined].filter(Boolean).join(' ') || undefined}
      aria-invalid={error || undefined} aria-required={required || undefined} aria-readonly={readOnly || undefined} tabIndex={-1}
      sx={[{ minWidth: 0, gap: cards ? 1.5 : 0.5, ...(cards ? { display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: `repeat(${columns}, minmax(0, 1fr))` } } : {}) },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
      onFocusCapture={(event) => { onFocusCapture?.(event); const node = event.target as HTMLInputElement; const index = Number(node.dataset.choiceIndex);
        if (node.dataset.choiceIndex != null && options[index]) focused.current = { value: options[index].value, node }; }}
      onBlurCapture={(event) => { onBlurCapture?.(event); if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) focused.current = null; }}
      onKeyDown={(event) => {
        onKeyDown?.(event); if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
        const node = event.target as HTMLInputElement;
        if (node.dataset.choiceIndex == null || node.closest('[role="radiogroup"]') !== root.current) return;
        const current = enabled.findIndex(({ index }) => index === Number(node.dataset.choiceIndex)); if (current < 0) return;
        const forward = direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight'; const backward = direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
        const next = event.key === 'ArrowDown' || event.key === forward ? (current + 1) % enabled.length
          : event.key === 'ArrowUp' || event.key === backward ? (current + enabled.length - 1) % enabled.length
            : event.key === 'Home' ? 0 : event.key === 'End' ? enabled.length - 1 : null;
        if (next !== null) { event.preventDefault(); input(enabled[next].index)?.focus(); choose(enabled[next].option, event); }
      }}>
      {options.map((option, index) => <FormControlLabel key={`${typeof option.value}:${option.value}`} disabled={disabled || option.disabled}
        control={<Radio checked={selected === option.value} value={option.value} required={required} size="small"
          onChange={(event) => choose(option, event)} slotProps={{ input: () => ({ 'data-choice-index': index,
            'aria-label': typeof option.label === 'string' ? option.label : undefined, 'aria-describedby': option.description != null ? `${groupId}-option-${index}` : undefined }) }} />}
        label={<Box component="span" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 1, minWidth: 0 }}>
          {option.icon != null ? <Box component="span" aria-hidden sx={{ display: 'flex', flexShrink: 0 }}>{option.icon}</Box> : null}
          <Box component="span" sx={{ minWidth: 0, flex: '1 1 100px' }}><Typography component="span" variant="body2" sx={{ display: 'block', fontWeight: 600 }}>{option.label}</Typography>
            {option.description != null ? <Typography id={`${groupId}-option-${index}`} component="span" variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>{option.description}</Typography> : null}</Box>
          {option.meta != null ? <Box component="span" sx={{ minWidth: 0, maxWidth: '100%' }}>{option.meta}</Box> : null}
        </Box>}
        sx={{ m: 0, minWidth: 0, alignItems: 'flex-start', '& .MuiFormControlLabel-label': { minWidth: 0, flex: 1, pt: '8px', overflowWrap: 'anywhere' },
          ...(cards ? { p: 1.5, border: 1, borderColor: selected === option.value ? 'primary.main' : 'divider', borderRadius: 1.5,
            bgcolor: selected === option.value ? 'action.selected' : 'background.paper', '&:focus-within': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 } } : {}) }} />)}
    </MuiRadioGroup>
    {helperText != null ? <FormHelperText component="div" id={helpId} sx={{ mx: 0, overflowWrap: 'anywhere' }}>{helperText}</FormHelperText> : null}
  </FormControl>;
}
