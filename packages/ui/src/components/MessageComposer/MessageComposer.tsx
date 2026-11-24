import * as React from 'react';
import { Box, useTheme } from '@mui/material';
import { TextArea } from '../TextArea';
import { Stack } from '../Stack';
import { ActionButton } from '../ActionButton';
import { useControllableValue } from '../../internal/useControllableValue';
import { identityColor } from '../../theme/category';
import { styles, type SurfaceProps } from '../../internal/presentation';
export interface MessageComposerHandle {
  focus(): void;
  clear(): void;
  insertText(text: string): void;
}
export interface MessageComposerProps extends Omit<
  SurfaceProps,
  'ref' | 'onChange' | 'onSubmit' | 'defaultValue' | 'children'
> {
  'aria-label': string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onSubmit: (value: string) => void;
  onStop?: () => void;
  busy?: boolean;
  disabled?: boolean;
  disabledReason?: React.ReactNode;
  placeholder?: string;
  submitOn?: 'enter' | 'mod+enter';
  minRows?: number;
  maxRows?: number;
  maxLength?: number;
  startActions?: React.ReactNode;
  endActions?: React.ReactNode;
  attachments?: React.ReactNode;
  status?: React.ReactNode;
  accentColor?: string;
  submitLabel?: string;
  stopLabel?: string;
  onPasteFiles?: (files: File[]) => void;
  onDropFiles?: (files: File[]) => void;
  ref?: React.Ref<MessageComposerHandle>;
}
export function MessageComposer({
  value,
  defaultValue = '',
  onChange,
  onSubmit,
  onStop,
  busy,
  disabled,
  disabledReason,
  placeholder,
  submitOn = 'enter',
  minRows = 1,
  maxRows = 12,
  maxLength,
  startActions,
  endActions,
  attachments,
  status,
  accentColor,
  submitLabel = 'Send',
  stopLabel = 'Stop',
  onPasteFiles,
  onDropFiles,
  density,
  ref,
  sx,
  'aria-label': label,
  ...props
}: MessageComposerProps) {
  const [draft, set] = useControllableValue(value, defaultValue);
  const input = React.useRef<HTMLTextAreaElement>(null),
    composing = React.useRef(false);
  const theme = useTheme(),
    reasonId = React.useId();
  const change = (next: string) => {
    set(next);
    onChange?.(next);
  };
  const submit = () => {
    if (disabled || busy || composing.current || !draft.trim()) return;
    onSubmit(draft);
    if (value === undefined) change('');
    input.current?.focus();
  };
  React.useImperativeHandle(ref, () => ({
    focus: () => input.current?.focus(),
    clear: () => change(''),
    insertText(text) {
      const el = input.current;
      if (!el || disabled) return;
      const start = el.selectionStart,
        end = el.selectionEnd;
      const insertion =
        maxLength == null ? text : text.slice(0, Math.max(0, maxLength - draft.length + end - start));
      change(draft.slice(0, start) + insertion + draft.slice(end));
      el.focus();
      requestAnimationFrame(() => el.setSelectionRange(start + insertion.length, start + insertion.length));
    }
  }));
  return (
    <Box
      {...props}
      role="group"
      aria-label={label}
      onDragOver={(e) => {
        props.onDragOver?.(e);
        if (!disabled && onDropFiles && e.dataTransfer.types.includes('Files')) e.preventDefault();
      }}
      onDrop={(e) => {
        props.onDrop?.(e);
        if (!e.defaultPrevented && !disabled && onDropFiles && e.dataTransfer.files.length) {
          e.preventDefault();
          onDropFiles(Array.from(e.dataTransfer.files));
        }
      }}
      onPaste={(e) => {
        props.onPaste?.(e);
        if (!e.defaultPrevented && !disabled && onPasteFiles && e.clipboardData.files.length) {
          e.preventDefault();
          onPasteFiles(Array.from(e.clipboardData.files));
        }
      }}
      sx={styles(
        {
          p: density === 'comfortable' ? 3 : 2,
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          minWidth: 0,
          ...(accentColor && {
            borderInlineStart: '3px solid',
            borderInlineStartColor: identityColor(theme, accentColor)
          })
        },
        sx
      )}
    >
      <Stack density={density}>
        {attachments}
        <TextArea
          aria-label={label}
          inputRef={input}
          value={draft}
          onChange={change}
          placeholder={placeholder}
          density={density}
          disabled={disabled}
          aria-describedby={disabled && disabledReason ? reasonId : undefined}
          minRows={minRows}
          maxRows={maxRows}
          maxLength={maxLength}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={() => {
            composing.current = false;
          }}
          onEnter={(_, e) => {
            if (composing.current || e.shiftKey || busy || (submitOn === 'mod+enter' && !e.metaKey && !e.ctrlKey))
              return;
            e.preventDefault();
            submit();
          }}
        />
        <Stack direction="row" align="center" wrap gap={1}>
          {startActions}
          <Box sx={{ flex: 1, overflowWrap: 'anywhere' }}>{status}</Box>
          {endActions}
          {busy && onStop ? (
            <ActionButton onClick={onStop} disabled={disabled}>
              {stopLabel}
            </ActionButton>
          ) : (
            <ActionButton variant="contained" disabled={disabled || busy || !draft.trim()} onClick={submit}>
              {submitLabel}
            </ActionButton>
          )}
        </Stack>
        {disabled && disabledReason && <Box id={reasonId}>{disabledReason}</Box>}
      </Stack>
    </Box>
  );
}
