import { FilterOperator } from '../query/filterOperators.js';

type OperatorMessageKeys = {
  [Name in keyof typeof FilterOperator as (typeof FilterOperator)[Name]]: `filters.operator.${Name}`;
};

const messageKeys = Object.fromEntries(
  Object.entries(FilterOperator).map(([name, operator]) => [operator, `filters.operator.${name}`]),
) as OperatorMessageKeys;

/** Returns the catalog key for a named filter operator or its wire literal. */
export function filterOperatorMessageKey<Operator extends FilterOperator>(operator: Operator): OperatorMessageKeys[Operator] {
  return messageKeys[operator];
}
