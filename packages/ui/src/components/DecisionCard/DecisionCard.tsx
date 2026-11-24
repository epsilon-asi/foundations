import * as React from 'react';
import { Panel, type PanelProps } from '../Panel';
import { ActivityGroup } from '../ActivityItem';
import { TextArea } from '../TextArea';
import { ActionButton } from '../ActionButton';
import { Stack } from '../Stack';
import { ShortcutHint } from '../Keycap';
import { StatusBadge } from '../StatusBadge';
import { DateDisplay, type DateValue } from '../DateDisplay';
import { Text } from '../Text';
import { Alert } from '../Alert';
import { useSubmission } from '../../internal/useSubmission';
export interface DecisionAction {
  id: string;
  label: string;
  kind?: 'primary' | 'secondary' | 'danger';
  description?: string;
  shortcut?: string;
  collectReason?: boolean | { label: string; placeholder?: string; required?: boolean };
}
export interface DecisionCardProps extends Omit<PanelProps, 'title'> {
  title: React.ReactNode;
  tone?: 'neutral' | 'info' | 'warning' | 'danger';
  description?: React.ReactNode;
  actions: readonly DecisionAction[];
  onDecision: (actionId: string, detail: { reason?: string }) => void | Promise<void>;
  resolution?: { actionId: string; label: React.ReactNode; at?: DateValue };
  collapseWhenResolved?: boolean;
  busy?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}
export function DecisionCard({
  title,
  tone = 'warning',
  description,
  children,
  actions,
  onDecision,
  resolution,
  collapseWhenResolved = true,
  busy,
  disabled,
  autoFocus,
  density,
  headingLevel = 'h3',
  sx,
  ...props
}: DecisionCardProps) {
  const [choice, setChoice] = React.useState<string>(),
    [reason, setReason] = React.useState('');
  const { pending, error, run } = useSubmission(resolution);
  const blocked = !!(busy || disabled || pending !== undefined);
  const primary = actions.find((a) => a.kind === 'primary');
  const ordered = primary ? [primary, ...actions.filter((a) => a !== primary)] : actions;
  const selected = actions.find((a) => a.id === choice),
    config = selected?.collectReason;
  const submit = (a: DecisionAction) => {
    if (!blocked)
      void run(a.id, () => onDecision(a.id, reason.trim() && a.collectReason ? { reason: reason.trim() } : {}));
  };
  const detail = (
    <Stack density={density}>
      {description && <Text>{description}</Text>}
      {children}
    </Stack>
  );
  const id = React.useId();
  if (resolution)
    return (
      <Panel {...props} role="group" aria-labelledby={id} density={density} sx={sx}>
        <ActivityGroup
          label={<span id={id}>{resolution.label}</span>}
          meta={resolution.at != null && <DateDisplay value={resolution.at} />}
          defaultExpanded={!collapseWhenResolved}
        >
          <Text as={headingLevel} variant="subtitle">
            {title}
          </Text>
          {detail}
        </ActivityGroup>
      </Panel>
    );
  return (
    <Panel
      {...props}
      role="group"
      density={density}
      title={title}
      headingLevel={headingLevel}
      aria-busy={busy || pending !== undefined || undefined}
      sx={sx}
      headerAction={<StatusBadge tone={tone === 'danger' ? 'error' : tone} label={tone} />}
    >
      <Stack density={density}>
        {detail}
        {config ? (
          <>
            <TextArea
              label={typeof config === 'object' ? config.label : 'Reason'}
              placeholder={typeof config === 'object' ? config.placeholder : undefined}
              required={typeof config === 'object' && config.required}
              autoFocus
              value={reason}
              disabled={blocked}
              onChange={setReason}
            />
            <Stack direction="row" wrap>
              <ActionButton
                disabled={blocked}
                onClick={() => {
                  setChoice(undefined);
                  setReason('');
                }}
              >
                Cancel
              </ActionButton>
              <ActionButton
                variant="contained"
                loading={pending === choice}
                disabled={blocked || (typeof config === 'object' && config.required && !reason.trim())}
                onClick={() => submit(selected!)}
              >
                {selected?.label}
              </ActionButton>
            </Stack>
          </>
        ) : (
          <Stack direction="row" wrap>
            {ordered.map((a, i) => (
              <Stack key={a.id} gap={0.5}>
                <ActionButton
                  variant={a === primary ? 'contained' : 'outlined'}
                  autoFocus={autoFocus && i === 0}
                  color={a.kind === 'danger' ? 'error' : 'primary'}
                  disabled={blocked}
                  loading={pending === a.id}
                  onClick={() => {
                    if (a.collectReason) {
                      setReason('');
                      setChoice(a.id);
                    } else submit(a);
                  }}
                >
                  {a.label}
                  {a.shortcut && <ShortcutHint keys={a.shortcut} />}
                </ActionButton>
                {a.description && <Text variant="caption">{a.description}</Text>}
              </Stack>
            ))}
          </Stack>
        )}
        {error && <Alert severity="error">{error}</Alert>}
      </Stack>
    </Panel>
  );
}
