import { expectTypeOf } from 'vitest';
import type { Defaulted, Id, IdOf, Readable, Tenant } from '../../src/index.js';

declare class RecordBase {
  key: Id<number>;
}
declare class Account extends RecordBase {
  organizationId: Tenant<string>;
  id: string;
  name?: Readable<string | null>;
  note: null;
  metadata: any;
  static secondary: Id<string>;
  getExternalKey(): Id<string>;
}

expectTypeOf<IdOf<Account>>().toEqualTypeOf<number>();
expectTypeOf<IdOf<typeof Account>>().toEqualTypeOf<number>();
expectTypeOf<IdOf<{ id: string; tenant: Tenant<number> }>>().toBeNever();
expectTypeOf<IdOf<{ key: Defaulted<Id<'local' | 'remote'>> }>>().toEqualTypeOf<'local' | 'remote'>();
expectTypeOf<IdOf<{ key: Id<Defaulted<string>> }>>().toEqualTypeOf<string>();
expectTypeOf<IdOf<{ key?: Id<string | null> }>>().toEqualTypeOf<string | null | undefined>();
