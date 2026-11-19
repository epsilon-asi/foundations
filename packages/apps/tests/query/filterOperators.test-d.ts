import { expectTypeOf } from 'vitest';
import {
  FilterOperator, type ArrayOperator, type BooleanOperator, type EnumOperator, type IdOperator,
  type RangeOperator, type TextOperator,
} from '../../src/index.js';

type Equality = '$eq' | '$ne';
type Membership = Equality | '$in' | '$nin';
expectTypeOf(FilterOperator.ILike).toEqualTypeOf<'$ilike'>();
expectTypeOf(FilterOperator.Gte).toEqualTypeOf<'$gte'>();
expectTypeOf<FilterOperator>().toEqualTypeOf<
  TextOperator | EnumOperator | RangeOperator | BooleanOperator | IdOperator | ArrayOperator | '$exists'
>();
expectTypeOf<TextOperator>().toEqualTypeOf<Membership | '$like' | '$ilike'>();
expectTypeOf<EnumOperator>().toEqualTypeOf<Membership>();
expectTypeOf<RangeOperator>().toEqualTypeOf<Membership | '$gt' | '$gte' | '$lt' | '$lte'>();
expectTypeOf<BooleanOperator>().toEqualTypeOf<Equality>();
expectTypeOf<IdOperator>().toEqualTypeOf<Membership>();
expectTypeOf<ArrayOperator>().toEqualTypeOf<'$contains' | '$overlap'>();

// Dates use the range group. Case-insensitive matching is available on text.
expectTypeOf<'$ilike'>().toExtend<TextOperator>();
expectTypeOf<'$ilike'>().not.toExtend<RangeOperator>();
expectTypeOf<'$gt'>().not.toExtend<TextOperator>();
