import { ApiDefinitionError } from '../endpoints/ApiDefinitionError.js';
import {
  FILTER_OPERATORS, type FilterOperator, type ArrayOperator, type BooleanOperator, type EnumOperator,
  type IdOperator, type RangeOperator, type TextOperator,
} from './filterOperators.js';

export type FilterFieldKind = Exclude<keyof typeof FILTER_OPERATORS, 'nullable'>;

export interface OperatorsByKind {
  text: TextOperator;
  enum: EnumOperator;
  range: RangeOperator;
  boolean: BooleanOperator;
  id: IdOperator;
  array: ArrayOperator;
}
type NullableOperator = (typeof FILTER_OPERATORS.nullable)[number];

/** A list.filter entry for a field of known kind. Nullability defaults to false. */
export type ResolveFilterOperatorsOptions = { kind: FilterFieldKind; nullable?: boolean; cap: true } | {
  [Kind in FilterFieldKind]: { kind: Kind } & (
    | { nullable?: boolean; cap: true | readonly OperatorsByKind[Kind][] }
    | { nullable: true; cap: true | readonly (OperatorsByKind[Kind] | NullableOperator)[] }
  );
}[FilterFieldKind];

/** The operator literals enabled by an individual field declaration. */
export type ResolvedFilterOperator<Options extends ResolveFilterOperatorsOptions> =
  Options extends { cap: readonly (infer Operator extends FilterOperator)[] } ? Operator :
  Options extends { kind: FilterFieldKind; nullable?: false } ? OperatorsByKind[Options['kind']] :
  OperatorsByKind[Options['kind']] | NullableOperator;

function assertFilterFieldKind(kind: unknown): asserts kind is FilterFieldKind {
  if (typeof kind !== 'string') throw new ApiDefinitionError('A filter field kind must be a string.');
  if (kind === 'nullable' || !Object.hasOwn(FILTER_OPERATORS, kind)) {
    throw new ApiDefinitionError(`Unsupported filter field kind "${kind}".`);
  }
}

/** Resolves a field's declaration to its frozen, ordered set of allowed operators. */
export function resolveFilterOperators<const Options extends ResolveFilterOperatorsOptions>(
  options: Options,
): readonly ResolvedFilterOperator<Options>[];
export function resolveFilterOperators({ kind, nullable = false, cap }: ResolveFilterOperatorsOptions): readonly FilterOperator[] {
  assertFilterFieldKind(kind);
  if (typeof nullable !== 'boolean') throw new ApiDefinitionError('Filter field nullability must be a boolean.');
  const allowed: readonly FilterOperator[] = nullable
    ? Object.freeze([...new Set([...FILTER_OPERATORS[kind], ...FILTER_OPERATORS.nullable])])
    : FILTER_OPERATORS[kind];
  if (cap === true) return allowed;
  if (!Array.isArray(cap)) throw new ApiDefinitionError('A filter declaration must be true or a list of operators.');

  for (const operator of cap) {
    if (!allowed.includes(operator)) {
      const label = typeof operator === 'string' ? `"${operator}"` : `of type ${typeof operator}`;
      throw new ApiDefinitionError(`Filter operator ${label} is unavailable for a ${kind} field.`);
    }
  }
  return Object.freeze([...new Set<FilterOperator>(cap)]);
}
