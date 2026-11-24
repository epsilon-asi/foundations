import * as React from 'react';
import {
  TextField as MuiTextField,
  InputAdornment,
  type TextFieldProps as MuiTextFieldProps
} from '@mui/material';
import { useForkRef } from '@mui/material/utils';
import { CloseIcon } from '../../internal/CloseIcon';
import { IconButton } from '../IconButton';
import { useControllableValue } from '../../internal/useControllableValue';
import { styles, type Density } from '../../internal/presentation';
import { themeMonospace } from '../../theme/category';

export type TextChangeReason = 'input' | 'clear';
export interface TextFieldProps extends Omit<
  MuiTextFieldProps,
  | 'value'
  | 'defaultValue'
  | 'onChange'
  | 'error'
  | 'type'
  | 'multiline'
  | 'rows'
  | 'minRows'
  | 'maxRows'
  | 'slotProps'
  | 'select'
  | 'variant'
> {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string, event: React.SyntheticEvent, reason: TextChangeReason) => void;
  error?: boolean | string;
  readOnly?: boolean;
  type?: 'text' | 'password' | 'email' | 'url' | 'number';
  startAdornment?: React.ReactNode;
  endAdornment?: React.ReactNode;
  clearable?: boolean;
  clearLabel?: string;
  monospace?: boolean;
  maxLength?: number;
  showCount?: boolean;
  onEnter?: (value: string, event: React.KeyboardEvent) => void;
  density?: Density;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement>;
}
export function FieldControl({
  value,
  defaultValue = '',
  onChange,
  id,
  helperText,
  error,
  readOnly,
  type,
  startAdornment,
  endAdornment,
  clearable,
  clearLabel = 'Clear',
  monospace,
  maxLength,
  showCount,
  onEnter,
  disabled,
  inputRef,
  InputProps,
  inputProps,
  onKeyDown,
  density = 'compact',
  sx,
  fullWidth = true,
  size = 'small',
  'aria-label': label,
  'aria-labelledby': labelledBy,
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
  multiline,
  minRows,
  maxRows,
  resize = 'none',
  ...props
}: TextFieldProps & {
  multiline?: boolean;
  minRows?: number;
  maxRows?: number;
  resize?: 'none' | 'vertical';
}) {
  const [text, set] = useControllableValue(value, defaultValue);
  const local = React.useRef<HTMLInputElement | HTMLTextAreaElement>(null),
    merged = useForkRef(local, inputRef);
  const generated = React.useId();
  const fieldId = id ?? generated;
  const message = typeof error === 'string' ? error : helperText;
  const hasHelp = message != null || showCount;
  const change = (next: string, event: React.SyntheticEvent, reason: TextChangeReason) => {
    set(next);
    onChange?.(next, event, reason);
  };
  return (
    <MuiTextField
      {...props}
      id={fieldId}
      inputRef={merged}
      fullWidth={fullWidth}
      size={size}
      type={type}
      disabled={disabled}
      multiline={multiline}
      minRows={minRows}
      maxRows={maxRows}
      value={text}
      error={!!error}
      onChange={(event) => change(event.target.value, event, 'input')}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (
          !event.defaultPrevented &&
          event.key === 'Enter' &&
          !event.nativeEvent.isComposing &&
          event.nativeEvent.keyCode !== 229
        )
          onEnter?.(text, event);
      }}
      helperText={
        hasHelp ? (
          <>
            {typeof error === 'string' ? <span role="alert">{message}</span> : message}
            {showCount && (
              <span>
                {message != null && ' · '}
                {text.length}
                {maxLength != null && ' / ' + maxLength}
              </span>
            )}
          </>
        ) : undefined
      }
      slotProps={{
        input: {
          ...InputProps,
          readOnly: readOnly ?? InputProps?.readOnly,
          startAdornment:
            startAdornment == null ? (
              InputProps?.startAdornment
            ) : (
              <InputAdornment position="start">{startAdornment}</InputAdornment>
            ),
          endAdornment:
            endAdornment == null && !clearable ? (
              InputProps?.endAdornment
            ) : (
              <InputAdornment position="end">
                {clearable && !!text && !readOnly && (
                  <IconButton
                    aria-label={clearLabel}
                    outlined={false}
                    disabled={disabled}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      change('', e, 'clear');
                      local.current?.focus();
                    }}
                  >
                    <CloseIcon />
                  </IconButton>
                )}
                {endAdornment}
              </InputAdornment>
            )
        },
        htmlInput: {
          ...inputProps,
          'aria-label': label ?? inputProps?.['aria-label'],
          'aria-labelledby': labelledBy ?? inputProps?.['aria-labelledby'],
          'aria-describedby':
            [describedBy ?? inputProps?.['aria-describedby'], hasHelp && fieldId + '-helper-text']
              .filter(Boolean)
              .join(' ') || undefined,
          'aria-invalid': error ? true : invalid,
          maxLength
        }
      }}
      sx={styles(
        {
          minWidth: 0,
          '& .MuiInputBase-root': {
            minHeight: density === 'compact' ? 28 : 36,
            ...(monospace && { fontFamily: themeMonospace })
          },
          '& textarea:not([aria-hidden])': { resize },
          '& .MuiFormHelperText-root': { mx: 0, overflowWrap: 'anywhere' }
        },
        sx
      )}
    />
  );
}
export function TextField(props: TextFieldProps) {
  return <FieldControl {...props} />;
}
