/** Named wire operators for list filters. */
export const FilterOperator = Object.freeze({
  Eq: '$eq',
  Ne: '$ne',
  In: '$in',
  Nin: '$nin',
  Like: '$like',
  ILike: '$ilike',
  Gt: '$gt',
  Gte: '$gte',
  Lt: '$lt',
  Lte: '$lte',
  Contains: '$contains',
  Overlap: '$overlap',
  Exists: '$exists',
});

export type FilterOperator = (typeof FilterOperator)[keyof typeof FilterOperator];

const equality = Object.freeze([FilterOperator.Eq, FilterOperator.Ne] as const);
const membership = Object.freeze([...equality, FilterOperator.In, FilterOperator.Nin] as const);

/** Operators available for each filterable field kind. */
export const FILTER_OPERATORS = Object.freeze({
  text: Object.freeze([...membership, FilterOperator.Like, FilterOperator.ILike] as const),
  enum: membership,
  range: Object.freeze([
    ...membership, FilterOperator.Gt, FilterOperator.Gte, FilterOperator.Lt, FilterOperator.Lte,
  ] as const),
  boolean: equality,
  id: membership,
  array: Object.freeze([FilterOperator.Contains, FilterOperator.Overlap] as const),
  /** Additional operators for nullable fields. The additional equality operand is null. */
  nullable: Object.freeze([FilterOperator.Exists, FilterOperator.Eq] as const),
});

// Extract keeps the group names visible in TypeScript's declaration errors.
export type TextOperator = Extract<FilterOperator, (typeof FILTER_OPERATORS.text)[number]>;
export type EnumOperator = Extract<FilterOperator, (typeof FILTER_OPERATORS.enum)[number]>;
export type RangeOperator = Extract<FilterOperator, (typeof FILTER_OPERATORS.range)[number]>;
export type BooleanOperator = Extract<FilterOperator, (typeof FILTER_OPERATORS.boolean)[number]>;
export type IdOperator = Extract<FilterOperator, (typeof FILTER_OPERATORS.id)[number]>;
export type ArrayOperator = Extract<FilterOperator, (typeof FILTER_OPERATORS.array)[number]>;
