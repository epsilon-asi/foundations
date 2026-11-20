import { expectTypeOf } from 'vitest';
import { FilterOperator, type ArrayOperator, type TextOperator } from '../../src/query/filterOperators.js';
import { resolveFilterOperators, type FilterFieldKind, type ResolveFilterOperatorsOptions } from '../../src/query/resolveFilterOperators.js';

expectTypeOf<FilterFieldKind>().toEqualTypeOf<'text' | 'enum' | 'range' | 'boolean' | 'id' | 'array'>();
const all = resolveFilterOperators({ kind: 'text', cap: true });
const text = resolveFilterOperators({ kind: 'text', cap: [FilterOperator.ILike, '$like'] });
const array = resolveFilterOperators({ kind: 'array', nullable: true, cap: true });
expectTypeOf(all).toEqualTypeOf<readonly TextOperator[]>();
expectTypeOf(text).toEqualTypeOf<readonly ('$ilike' | '$like')[]>();
expectTypeOf(array).toEqualTypeOf<readonly (ArrayOperator | '$eq' | '$exists')[]>();
function selectText(cap: true | readonly TextOperator[]) {
  return resolveFilterOperators({ kind: 'text', cap });
}
expectTypeOf(selectText).returns.toEqualTypeOf<readonly TextOperator[]>();

// @ts-expect-error The kind still constrains an explicitly typed declaration.
const invalid: ResolveFilterOperatorsOptions = { kind: 'text', cap: ['$gt'] };
// @ts-expect-error Omitting nullable disallows the extra existence operator.
resolveFilterOperators({ kind: 'text', cap: ['$exists'] });
// @ts-expect-error An explicit false nullability declaration also disallows the extra operator.
resolveFilterOperators({ kind: 'text', nullable: false, cap: ['$exists'] });
