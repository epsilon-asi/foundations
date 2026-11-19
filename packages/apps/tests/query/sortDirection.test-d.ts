import { expectTypeOf } from 'vitest';
import { SortDirection } from '../../src/index.js';

expectTypeOf(SortDirection.Asc).toEqualTypeOf<'asc'>();
expectTypeOf(SortDirection.Desc).toEqualTypeOf<'desc'>();
expectTypeOf<SortDirection>().toEqualTypeOf<'asc' | 'desc'>();
