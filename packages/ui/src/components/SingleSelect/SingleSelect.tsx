import * as React from 'react';
import { SelectControl, type SelectCommonProps, type SelectChangeReason, type SelectValue } from '../../internal/SelectControl';

export type { SelectOption, SelectValue, SelectChangeReason, SelectCloseReason, SelectOptionState } from '../../internal/SelectControl';
export interface SingleSelectProps<Value extends SelectValue = string> extends SelectCommonProps<Value> {
  value?: Value | null;
  defaultValue?: Value | null;
  onChange?: (value: Value | null, event: React.SyntheticEvent, reason: SelectChangeReason) => void;
  ref?: React.Ref<HTMLDivElement>;
}

export function SingleSelect<Value extends SelectValue = string>({ value, defaultValue = null, onChange, ...props }: SingleSelectProps<Value>) {
  const [internal, setValue] = React.useState<Value | null>(defaultValue);
  const selected = value === undefined ? internal : value;
  return <SelectControl {...props} multiple={false} values={selected === null ? [] : [selected]}
    onValuesChange={(values, event, reason) => {
      const next = values[0] ?? null;
      if (value === undefined) setValue(next);
      onChange?.(next, event, reason);
    }} />;
}
