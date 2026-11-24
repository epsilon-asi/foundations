import * as React from 'react';
import { Box, ButtonBase } from '@mui/material';
import { Text } from '../Text';
import { Stack } from '../Stack';
import { StatusBadge, type StatusBadgeTone } from '../StatusBadge';
import { useControllableValue } from '../../internal/useControllableValue';
import { styles, reducedMotion, type SurfaceProps } from '../../internal/presentation';
export interface ActivityItemProps extends SurfaceProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  monospaceTitle?: boolean;
  meta?: React.ReactNode;
  status?: 'pending' | 'running' | 'success' | 'error' | 'declined' | 'cancelled';
  statusLabel?: string;
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  disabled?: boolean;
  actions?: React.ReactNode;
  keepMounted?: boolean;
}
const statuses = {
  pending: ['○', 'neutral'],
  running: ['◌', 'info'],
  success: ['✓', 'success'],
  error: ['!', 'error'],
  declined: ['−', 'warning'],
  cancelled: ['×', 'neutral']
} as const;
export function ActivityItem({
  icon,
  title,
  monospaceTitle,
  meta,
  status,
  statusLabel,
  expanded,
  defaultExpanded = false,
  onExpandedChange,
  disabled,
  actions,
  keepMounted,
  children,
  density,
  sx,
  ...props
}: ActivityItemProps) {
  const [open, set] = useControllableValue(expanded, defaultExpanded),
    id = React.useId();
  const summary = (
    <>
      {children != null && <span aria-hidden>{open ? '▾' : '▸'}</span>}
      {icon}
      <Text truncate variant={monospaceTitle ? 'code' : 'bodySmall'} sx={{ flex: 1, textAlign: 'start' }}>
        {title}
      </Text>
      {meta && (
        <Text variant="caption" tone="secondary">
          {meta}
        </Text>
      )}
    </>
  );
  return (
    <Box {...props} sx={styles({ minWidth: 0, ...reducedMotion }, sx)}>
      <Stack direction="row" align="center" gap={1} sx={{ minHeight: density === 'comfortable' ? 36 : 28 }}>
        {children != null ? (
          <ButtonBase
            id={id}
            aria-controls={id + '-body'}
            aria-expanded={open}
            disabled={disabled}
            onClick={() => {
              set(!open);
              onExpandedChange?.(!open);
            }}
            sx={{
              flex: 1,
              minWidth: 0,
              alignSelf: 'stretch',
              gap: 1,
              '&:focus-visible': { outline: '2px solid currentColor' }
            }}
          >
            {summary}
          </ButtonBase>
        ) : (
          <Stack direction="row" align="center" gap={1} sx={{ flex: 1 }}>
            {summary}
          </Stack>
        )}
        {status && (
          <StatusBadge
            size="small"
            indicator={false}
            label={(status === 'running' ? '' : statuses[status][0] + ' ') + (statusLabel ?? status)}
            tone={statuses[status][1] as StatusBadgeTone}
            sx={
              status === 'running'
                ? {
                    '&::before': { content: '"◌"', animation: 'activity-spin 1s linear infinite' },
                    '@keyframes activity-spin': { to: { transform: 'rotate(360deg)' } }
                  }
                : undefined
            }
          />
        )}
        {actions}
      </Stack>
      {children != null && (
        <Box
          id={id + '-body'}
          role="region"
          aria-labelledby={id}
          hidden={!open}
          sx={{ p: density === 'comfortable' ? 3 : 2 }}
        >
          {(open || keepMounted) && children}
        </Box>
      )}
    </Box>
  );
}
export interface ActivityGroupProps extends Omit<ActivityItemProps, 'title' | 'status'> {
  label: React.ReactNode;
}
export function ActivityGroup({ label, ...props }: ActivityGroupProps) {
  return <ActivityItem {...props} title={label} />;
}
