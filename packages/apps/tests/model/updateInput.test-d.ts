import { expectTypeOf } from 'vitest';
import type {
  CreateOnly, Defaulted, Editable, Id, Internal, Readable, Secret, Tenant, UpdateInput, UpdateOnly, WriteOnly,
} from '../../src/index.js';

declare class Base {
  id: Id<number>;
  organizationId: Tenant<string>;
  readonly revision: UpdateOnly<number>;
  source: CreateOnly<string>;
  refresh(): void;
}

declare class Account extends Base {
  name: Editable<string | null>;
  password: WriteOnly<string>;
  manager?: Editable<Account>;
  expiresAt: Defaulted<UpdateOnly<Date | null>>;
  createdAt: Readable<Date>;
  credential: Secret<string>;
  memo: Internal<string>;
  hidden: boolean;
}

type AccountPatch = {
  readonly revision?: number;
  name?: string | null;
  password?: string;
  manager?: AccountPatch;
  expiresAt?: Date | null;
};

expectTypeOf<UpdateInput<Account>>().toEqualTypeOf<AccountPatch>();
expectTypeOf<UpdateInput<typeof Account>>().toEqualTypeOf<AccountPatch>();
const empty: UpdateInput<Account> = {};
const passwordChange: UpdateInput<Account> = { password: 'replacement' };
// @ts-expect-error The source can only be supplied on create.
const sourceChange: UpdateInput<Account> = { source: 'import' };
// @ts-expect-error Nested updates also exclude server-set IDs.
const managerChange: UpdateInput<Account> = { manager: { id: 42 } };

type Batch = {
  accounts: Editable<readonly (Account | null)[]>;
  details: UpdateOnly<{ seats: number; owner: Account }>;
  state: Defaulted<CreateOnly<string>>;
};
expectTypeOf<UpdateInput<Batch>>().toEqualTypeOf<{
  accounts?: readonly (AccountPatch | null)[];
  details?: { seats: number; owner: AccountPatch };
}>();

type Guarded = UpdateInput<{
  mixed: CreateOnly<string> | UpdateOnly<number>;
  sensitive: Editable<string> | Secret<Editable<number>>;
  ambiguous: any;
  allowed: WriteOnly<'one'> | UpdateOnly<'two'>;
}>;
expectTypeOf<Guarded>().toEqualTypeOf<{ allowed?: 'one' | 'two' }>();
expectTypeOf<UpdateInput<{ a: Editable<number> } | { b: UpdateOnly<string> }>>()
  .toEqualTypeOf<{ a?: number } | { b?: string }>();

type Immutable = { id: Id<string>; code: CreateOnly<string> };
type EmptyPatch = UpdateInput<Immutable>;
expectTypeOf<keyof EmptyPatch>().toBeNever();
const emptyPatch: EmptyPatch = {};
// @ts-expect-error A resource with no update grants still excludes create-only fields.
const immutableChange: EmptyPatch = { code: 'changed' };
// @ts-expect-error A patch must be an object.
const primitivePatch: EmptyPatch = 42;
type MixedPatch = UpdateInput<Immutable | { label: Editable<string> }>;
const validMixedPatch: MixedPatch = { label: 'updated' };
// @ts-expect-error Neither member grants update access to the ID.
const invalidMixedPatch: MixedPatch = { id: '123' };
