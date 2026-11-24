import { Box, useTheme } from '@mui/material';
import * as React from 'react';
import { DateDisplay, type DateValue } from '../DateDisplay';
import { ActionButton } from '../ActionButton';
import { Stack } from '../Stack';
import { Text } from '../Text';
import { Alert } from '../Alert';
import { identityStripe } from '../../theme/category';
import { styles, type SurfaceProps } from '../../internal/presentation';
export interface MessageProps extends Omit<SurfaceProps, 'role' | 'ref'> {
  role: 'user' | 'assistant' | 'system' | 'notice';
  author?: React.ReactNode;
  avatar?: React.ReactNode;
  timestamp?: DateValue;
  status?: 'streaming' | 'complete' | 'stopped' | 'error';
  error?: React.ReactNode;
  onRetry?: () => void;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  variant?: 'bubble' | 'plain';
  align?: 'start' | 'end';
  accentColor?: string;
  highlighted?: boolean;
  ref?: React.Ref<HTMLElement>;
}
export function Message({
  role,
  author,
  avatar,
  timestamp,
  status,
  error,
  onRetry,
  actions,
  footer,
  variant = 'bubble',
  align = role === 'user' ? 'end' : 'start',
  accentColor,
  highlighted,
  children,
  density,
  sx,
  ...props
}: MessageProps) {
  const id = React.useId(),
    theme = useTheme();
  if (role === 'notice')
    return (
      <Stack
        as="article"
        direction="row"
        align="center"
        justify="center"
        gap={density === 'comfortable' ? 2 : 1}
        wrap
        {...props}
        aria-labelledby={id}
        sx={styles(
          {
            textAlign: 'center',
            typography: 'caption',
            color: 'text.secondary',
            overflowWrap: 'anywhere',
            bgcolor: highlighted ? 'action.selected' : undefined
          },
          sx
        )}
      >
        <span id={id}>
          {author ?? 'Notice'}
          {timestamp != null && <DateDisplay value={timestamp} />}
        </span>
        {children}
        {status && <span>{status}</span>}
        {actions}
        {footer}
      </Stack>
    );
  return (
    <Stack
      as="article"
      direction="row"
      justify={align === 'end' ? 'flex-end' : 'flex-start'}
      {...props}
      aria-labelledby={[id, timestamp != null && id + '-time'].filter(Boolean).join(' ')}
      sx={styles(
        {
          overflowWrap: 'anywhere',
          '& .message-actions': { opacity: 0 },
          '&:hover .message-actions, &:focus-within .message-actions': { opacity: 1 },
          '@media (hover:none)': { '& .message-actions': { opacity: 1 } }
        },
        sx
      )}
    >
      <Stack
        density={density}
        sx={{
          maxWidth: '100%',
          bgcolor: highlighted ? 'action.selected' : variant === 'bubble' ? 'action.hover' : undefined,
          p: variant === 'plain' ? 0 : density === 'comfortable' ? 3 : 2,
          borderRadius: 1,
          textAlign: 'start',
          ...identityStripe(theme, accentColor)
        }}
      >
        <Stack direction="row" align="center" gap={1} wrap>
          {avatar}
          <Text id={id} variant="label" weight="medium">
            {author ?? role}
          </Text>
          {timestamp != null && (
            <DateDisplay
              id={id + '-time'}
              value={timestamp}
              formatOptions={{ hour: '2-digit', minute: '2-digit' }}
              sx={{ width: 'auto', border: 0, p: 0 }}
            />
          )}
          {status && (
            <Text variant="caption" tone={status === 'error' ? 'error' : 'secondary'}>
              {status}
            </Text>
          )}
          {actions && <Box className="message-actions">{actions}</Box>}
        </Stack>
        {children}
        {error && <Alert severity="error">{error}</Alert>}
        {onRetry && <ActionButton onClick={onRetry}>Retry</ActionButton>}
        {footer}
      </Stack>
    </Stack>
  );
}
