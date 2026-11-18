import { ChoiceGroup, type ChoiceGroupProps, type ChoiceValue } from '../../internal/ChoiceGroup';
export type { RadioOption } from '../../internal/ChoiceGroup';
export interface RadioGroupProps<Value extends ChoiceValue = string> extends ChoiceGroupProps<Value> {}
export function RadioGroup<Value extends ChoiceValue = string>(props: RadioGroupProps<Value>) { return <ChoiceGroup {...props} />; }
