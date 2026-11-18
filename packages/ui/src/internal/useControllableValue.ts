import * as React from 'react';

export function useControllableValue<Value>(value: Value | undefined, defaultValue: Value) {
  const [internal, setInternal] = React.useState(defaultValue);
  const set = (next: Value) => { if (value === undefined) setInternal(next); };
  return [value === undefined ? internal : value, set] as const;
}
