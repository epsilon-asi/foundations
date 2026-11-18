import { ChoiceGroup, type ChoiceGroupProps, type ChoiceValue } from '../../internal/ChoiceGroup';
export interface ChoiceCardGroupProps<Value extends ChoiceValue = string> extends ChoiceGroupProps<Value> { columns?: 1 | 2 | 3 }
export function ChoiceCardGroup<Value extends ChoiceValue = string>(props: ChoiceCardGroupProps<Value>) { return <ChoiceGroup {...props} cards />; }
