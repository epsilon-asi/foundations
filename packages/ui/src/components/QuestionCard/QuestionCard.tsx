import * as React from 'react';
import { Panel, type PanelProps } from '../Panel';
import { ChoiceCardGroup } from '../ChoiceCardGroup';
import { RadioGroup } from '../RadioGroup';
import { Checkbox } from '../Checkbox';
import { TextField } from '../TextField';
import { ActionButton } from '../ActionButton';
import { Stack } from '../Stack';
import { Text } from '../Text';
import { Alert } from '../Alert';
import { DateDisplay, type DateValue } from '../DateDisplay';
import { useSubmission } from '../../internal/useSubmission';
export interface Question {
  id: string;
  header?: string;
  question: string;
  options: ReadonlyArray<{ label: string; description?: string }>;
  multiSelect?: boolean;
  allowOther?: boolean | { label: string; placeholder?: string };
}
export type QuestionAnswers = Record<string, string | string[]>;
export interface QuestionCardProps extends Omit<PanelProps, 'onSubmit'> {
  questions: readonly Question[];
  onSubmit: (answers: QuestionAnswers) => void | Promise<void>;
  onDismiss?: () => void;
  submitLabel?: string;
  resolution?: { answers: QuestionAnswers; at?: DateValue };
  busy?: boolean;
  disabled?: boolean;
}
interface Selection {
  choices: string[];
  other: boolean;
  text: string;
}
const blank: Selection = { choices: [], other: false, text: '' };
export function QuestionCard({
  title = 'Questions',
  questions,
  onSubmit,
  onDismiss,
  submitLabel = 'Submit',
  resolution,
  busy,
  disabled,
  density,
  ...props
}: QuestionCardProps) {
  const [draft, setDraft] = React.useState<Record<string, Selection>>(() => Object.create(null)),
    [attempted, setAttempted] = React.useState(false);
  const { pending, run, error } = useSubmission(resolution);
  const locked = !!(busy || disabled || pending);
  const update = (id: string, patch: Partial<Selection>) =>
    setDraft((d) => ({ ...d, [id]: { ...(Object.hasOwn(d, id) ? d[id] : blank), ...patch } }));
  const answers: QuestionAnswers = Object.create(null);
  const missing = new Set<string>();
  for (const q of questions) {
    const d = Object.hasOwn(draft, q.id) ? draft[q.id] : blank,
      other = !!q.allowOther && d.other;
    const values = d.choices.filter((v) => q.options.some((o) => o.label === v));
    if (other && d.text.trim()) values.push(d.text.trim());
    if (!values.length || (other && !d.text.trim())) missing.add(q.id);
    answers[q.id] = q.multiSelect ? values : (values[0] ?? '');
  }
  return (
    <Panel {...props} title={title} role="group" density={density}>
      <Stack density={density}>
        {questions.map((q) => {
          if (resolution) {
            const value = resolution.answers[q.id];
            return (
              <Stack key={q.id} gap={1}>
                <Text weight="medium">{q.question}</Text>
                <Text>{Array.isArray(value) ? value.join(', ') : (value ?? '—')}</Text>
              </Stack>
            );
          }
          const d = Object.hasOwn(draft, q.id) ? draft[q.id] : blank,
            other = typeof q.allowOther === 'object' ? q.allowOther : { label: 'Other' };
          const options = q.options.map((o, i) => ({ ...o, value: i }));
          const SingleChoice = q.options.some((option) => option.description) ? ChoiceCardGroup : RadioGroup;
          const otherId = options.length;
          if (q.allowOther) options.push({ label: other.label, value: otherId });
          return (
            <Stack key={q.id} gap={1}>
              {q.header && <Text variant="caption">{q.header}</Text>}
              {q.multiSelect ? (
                <Stack as="fieldset" gap={1} sx={{ m: 0, p: 0, border: 0 }}>
                  <Text as="legend" weight="medium">
                    {q.question}
                  </Text>
                  {options.map((o) => (
                    <Checkbox
                      key={o.value}
                      label={o.label}
                      helperText={o.description}
                      disabled={locked}
                      checked={o.value === otherId ? d.other : d.choices.includes(o.label)}
                      onChange={(_, checked) =>
                        update(
                          q.id,
                          o.value === otherId
                            ? { other: checked }
                            : {
                                choices: checked ? [...d.choices, o.label] : d.choices.filter((v) => v !== o.label)
                              }
                        )
                      }
                    />
                  ))}
                </Stack>
              ) : (
                <SingleChoice
                  label={q.question}
                  options={options}
                  value={d.other ? otherId : (options.find((o) => o.label === d.choices[0])?.value ?? null)}
                  disabled={locked}
                  onChange={(i) =>
                    update(q.id, { other: i === otherId, choices: i === otherId ? [] : [options[i].label] })
                  }
                />
              )}
              {q.allowOther && d.other && (
                <TextField
                  label={other.label}
                  placeholder={other.placeholder}
                  value={d.text}
                  disabled={locked}
                  onChange={(text) => update(q.id, { text })}
                />
              )}
              {attempted && missing.has(q.id) && (
                <Text role="alert" tone="error">
                  Choose an answer.
                </Text>
              )}
            </Stack>
          );
        })}
        {resolution?.at != null && <DateDisplay value={resolution.at} />}
        {!resolution && (
          <Stack direction="row" wrap>
            <ActionButton
              variant="contained"
              disabled={locked}
              loading={!!pending}
              onClick={() => {
                setAttempted(true);
                if (!missing.size) void run('submit', () => onSubmit(answers));
              }}
            >
              {submitLabel}
            </ActionButton>
            {onDismiss && (
              <ActionButton disabled={locked} onClick={onDismiss}>
                Dismiss
              </ActionButton>
            )}
          </Stack>
        )}
        {error && <Alert severity="error">{error}</Alert>}
      </Stack>
    </Panel>
  );
}
