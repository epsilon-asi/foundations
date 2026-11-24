import * as React from 'react';
import { Box } from '@mui/material';
import { TextField, type TextFieldProps } from '../TextField';
import { ShortcutHint } from '../Keycap';
import { ProgressIndicator } from '../ProgressIndicator';
import { useControllableValue } from '../../internal/useControllableValue';
export interface SearchFieldProps extends TextFieldProps {
  'aria-label': string;
  /** Let an enclosing combobox or dialog handle Escape when false. */
  clearOnEscape?: boolean;
  onSearch?: (value: string) => void;
  debounceMs?: number;
  onDebouncedChange?: (value: string) => void;
  loading?: boolean;
  shortcut?: string;
  resultsLabel?: string;
}
export function SearchField({
  value,
  defaultValue = '',
  onChange,
  onSearch,
  debounceMs = 200,
  onDebouncedChange,
  loading,
  shortcut,
  resultsLabel,
  clearable = true,
  clearOnEscape = true,
  onKeyDown,
  inputProps,
  endAdornment,
  sx,
  ...props
}: SearchFieldProps) {
  const [text, set] = useControllableValue(value, defaultValue);
  const callback = React.useRef(onDebouncedChange);
  callback.current = onDebouncedChange;
  const last = React.useRef(text);
  React.useEffect(() => {
    if (last.current === text) return;
    const timer = setTimeout(
      () => {
        last.current = text;
        callback.current?.(text);
      },
      Math.max(0, debounceMs)
    );
    return () => clearTimeout(timer);
  }, [text, debounceMs]);
  const change: NonNullable<TextFieldProps['onChange']> = (next, event, reason) => {
    set(next);
    onChange?.(next, event, reason);
  };
  return (
    <Box role="search" aria-label={props['aria-label']} sx={sx}>
      <TextField
        {...props}
        inputProps={{ role: 'searchbox', ...inputProps }}
        value={text}
        onChange={change}
        clearable={clearable}
        endAdornment={
          shortcut ? (
            <>
              {endAdornment}
              <ShortcutHint keys={shortcut} />
            </>
          ) : (
            endAdornment
          )
        }
        onEnter={(next, event) => {
          props.onEnter?.(next, event);
          if (!event.defaultPrevented) onSearch?.(next);
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (
            clearOnEscape &&
            !e.defaultPrevented &&
            e.key === 'Escape' &&
            text &&
            !props.readOnly &&
            !e.nativeEvent.isComposing
          ) {
            e.preventDefault();
            e.stopPropagation();
            change('', e, 'clear');
          }
        }}
      />
      {loading && <ProgressIndicator label="Searching" />}
      <Box role="status" sx={{ typography: 'caption' }}>
        {resultsLabel}
      </Box>
    </Box>
  );
}
