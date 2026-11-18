import * as React from 'react';
import { SingleSelect, type SingleSelectProps, type SelectOption, type SelectValue } from '../SingleSelect';

export type EnumSelectSource = Readonly<Record<string, SelectValue>> | readonly SelectValue[];
export type EnumSelectValue<Source extends EnumSelectSource> = Source extends readonly (infer Value extends SelectValue)[] ? Value
  : Source extends Readonly<Record<string, SelectValue>> ? Source[keyof Source] : never;
export interface EnumSelectProps<Source extends EnumSelectSource> extends Omit<SingleSelectProps<EnumSelectValue<Source>>, 'options'> {
  enumValues: Source;
  /** Customize labels, descriptions, icons, grouping and availability without schema/form dependencies. */
  getOptionDetails?: (value: EnumSelectValue<Source>, memberName: string) => Partial<Omit<SelectOption<EnumSelectValue<Source>>, 'value'>>;
}

function humanize(value: string) {
  const spaced = value.replace(/([a-z\d])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
  const text = spaced === spaced.toUpperCase() ? spaced.toLowerCase() : spaced;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Accepts TypeScript enums, const objects and readonly literal arrays; numeric reverse mappings are excluded. */
export function EnumSelect<Source extends EnumSelectSource>({ enumValues, getOptionDetails, ...props }: EnumSelectProps<Source>) {
  const options = React.useMemo(() => {
    const entries = Array.isArray(enumValues) ? enumValues.map((value) => [String(value), value] as const)
      : Object.entries(enumValues).filter(([key, value]) => !(typeof value === 'string'
        && typeof (enumValues as Readonly<Record<string, SelectValue>>)[value] === 'number'
        && String((enumValues as Readonly<Record<string, SelectValue>>)[value]) === key));
    const seen = new Set<SelectValue>();
    return entries.flatMap(([key, value]) => {
      if (seen.has(value)) return [];
      seen.add(value);
      const typedValue = value as EnumSelectValue<Source>;
      const details = getOptionDetails?.(typedValue, key);
      return [{ ...details, value: typedValue, label: details?.label ?? humanize(key) }];
    });
  }, [enumValues, getOptionDetails]);
  return <SingleSelect<EnumSelectValue<Source>> {...props} options={options} />;
}
