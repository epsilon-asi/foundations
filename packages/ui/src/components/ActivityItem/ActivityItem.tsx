import * as React from 'react';
import { InspectorSection, type InspectorSectionProps } from '../InspectorSection';
import { StreamingIndicator } from '../StreamingIndicator';
import { Text } from '../Text';
import { Stack } from '../Stack';
import { StatusBadge } from '../StatusBadge';
import { styles, type SurfaceProps } from '../../internal/presentation';
export interface ActivityItemProps
  extends
    SurfaceProps,
    Pick<InspectorSectionProps, 'expanded' | 'defaultExpanded' | 'onExpandedChange' | 'disabled' | 'keepMounted'> {
  icon?: React.ReactNode;
  title: React.ReactNode;
  monospaceTitle?: boolean;
  meta?: React.ReactNode;
  status?: 'pending' | 'running' | 'success' | 'error' | 'declined' | 'cancelled';
  statusLabel?: string;
  actions?: React.ReactNode;
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
  const summary = (
    <Stack as="span" direction="row" align="center" gap={1} sx={{ width: '100%' }}>
      {icon}
      <Text truncate variant={monospaceTitle ? 'code' : 'bodySmall'} sx={{ flex: 1 }}>
        {title}
      </Text>
      {meta && (
        <Text variant="caption" tone="secondary">
          {meta}
        </Text>
      )}
    </Stack>
  );
  return (
    <InspectorSection
      {...props}
      title={summary}
      collapsible={children != null}
      expanded={expanded}
      defaultExpanded={defaultExpanded}
      onExpandedChange={onExpandedChange}
      disabled={disabled}
      keepMounted={keepMounted}
      density={density}
      headerAction={
        (status || actions) && (
          <>
            {status && (
              <StatusBadge
                indicator={false}
                tone={statuses[status][1]}
                icon={status === 'running' ? <StreamingIndicator label={statusLabel ?? status} /> : undefined}
                label={(status === 'running' ? '' : statuses[status][0] + ' ') + (statusLabel ?? status)}
              />
            )}
            {actions}
          </>
        )
      }
      variant="elevation"
      elevation={0}
      headerDivider={false}
      headerSx={{
        flexWrap: 'nowrap',
        minHeight: density === 'comfortable' ? 36 : 28,
        p: 0
      }}
      contentSx={children == null ? { p: 0 } : undefined}
      sx={styles({ bgcolor: 'transparent' }, sx)}
    >
      {children}
    </InspectorSection>
  );
}

export interface ActivityGroupProps extends Omit<ActivityItemProps, 'title' | 'status'> {
  label: React.ReactNode;
}
export function ActivityGroup({ label, ...props }: ActivityGroupProps) {
  return <ActivityItem {...props} title={label} />;
}
