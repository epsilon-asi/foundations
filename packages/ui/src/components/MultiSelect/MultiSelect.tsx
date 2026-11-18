import * as React from 'react';
import { SelectControl, type SelectCommonProps, type SelectChangeReason, type SelectValue } from '../../internal/SelectControl';

export interface MultiSelectProps<Value extends SelectValue = string> extends SelectCommonProps<Value> {
  value?: readonly Value[];
  defaultValue?: readonly Value[];
  onChange?: (value: Value[], event: React.SyntheticEvent, reason: SelectChangeReason) => void;
  /** Defaults to staying open for further selections. */
  closeOnSelect?: boolean;
  /** Number of chips shown when unfocused; -1 shows all. */
  limitTags?: number;
  ref?: React.Ref<HTMLDivElement>;
}

export function MultiSelect<Value extends SelectValue = string>({ value, defaultValue = [], onChange, ...props }: MultiSelectProps<Value>) {
  const [internal, setValue] = React.useState<readonly Value[]>(defaultValue);
  return <SelectControl {...props} multiple values={value ?? internal}
    onValuesChange={(values, event, reason) => {
      if (value === undefined) setValue(values);
      onChange?.(values, event, reason);
    }} />;
}
