import * as React from 'react';
import { Box, SvgIcon } from '@mui/material';
import { EmptyState, type EmptyStateProps } from '../EmptyState';
import { ActionButton } from '../ActionButton';
import { Alert } from '../Alert';
import { InspectorSection } from '../InspectorSection';

export interface ErrorStateProps extends Omit<EmptyStateProps, 'action'> {
  onRetry?: () => void | Promise<void>;
  retryLabel?: string;
  retryingLabel?: string;
  retrying?: boolean;
  retryDisabled?: boolean;
  onRetryError?: (error: Error) => void;
  retryErrorMessage?: React.ReactNode;
  actions?: React.ReactNode;
  details?: React.ReactNode;
  detailsLabel?: string;
}
export function ErrorState({ onRetry, retryLabel = 'Try again', retryingLabel = 'Retrying…', retrying = false, retryDisabled = false,
  onRetryError, retryErrorMessage = 'Retry failed. Please try again.', actions, details, detailsLabel = 'Error details', children,
  icon = <SvgIcon color="error"><path d="M12 2 1 21h22Zm-1 6h2v7h-2Zm0 9h2v2h-2Z" /></SvgIcon>, role = 'alert', ...props }: ErrorStateProps) {
  const [pending, setPending] = React.useState(false); const [failed, setFailed] = React.useState(false);
  const busy = React.useRef(false); const mounted = React.useRef(true);
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const retry = async () => {
    if (!onRetry || retrying || retryDisabled || busy.current) return;
    busy.current = true; setPending(true); setFailed(false);
    let failure: Error | undefined;
    try { await onRetry(); } catch (error) { failure = error instanceof Error ? error : new Error('Retry failed'); }
    if (!mounted.current) return;
    busy.current = false; setPending(false); setFailed(!!failure); if (failure) onRetryError?.(failure);
  };
  return <EmptyState {...props} role={role} icon={icon} action={onRetry || actions != null ? <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
    {onRetry ? <ActionButton variant="outlined" onClick={retry} disabled={retryDisabled || retrying} loading={pending || retrying} loadingLabel={retryingLabel}
      aria-busy={pending || retrying || undefined}>{retryLabel}</ActionButton> : null}{actions}
  </Box> : undefined}>
    {failed ? <Alert severity="error" role="status">{retryErrorMessage}</Alert> : null}
    {details != null ? <InspectorSection title={detailsLabel} defaultExpanded={false} sx={{ width: '100%', textAlign: 'start' }}>
      <Box sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{details}</Box>
    </InspectorSection> : null}{children}
  </EmptyState>;
}
