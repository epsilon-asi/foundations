import { expectTypeOf } from 'vitest';
import type {
  CreateInput, CreateOnly, Defaulted, Editable, Id, Internal, Readable, Secret, Tenant, UpdateOnly, WriteOnly,
} from '../../src/index.js';

declare class Base {
  id: Id<number>;
  organizationId: Tenant<string>;
  readonly source: CreateOnly<'web' | 'phone'>;
  refresh(): void;
}

declare class Account extends Base {
  name: Editable<string>;
  password: WriteOnly<string>;
  manager?: Editable<Account | null>;
  seats: Defaulted<Editable<number>>;
  joinedAt: CreateOnly<Defaulted<Date>>;
  details: CreateOnly<string | undefined>;
  revision: UpdateOnly<number>;
  timestamp: Readable<Date>;
  privateKey: Secret<string>;
  memo: Internal<string>;
  hidden: boolean;
}

type NewAccount = {
  readonly source: 'web' | 'phone';
  name: string;
  password: string;
  manager?: NewAccount | null;
  seats?: number;
  joinedAt?: Date;
  details: string | undefined;
};

expectTypeOf<CreateInput<Account>>().toEqualTypeOf<NewAccount>();
expectTypeOf<CreateInput<typeof Account>>().toEqualTypeOf<NewAccount>();
const input: CreateInput<typeof Account> = { source: 'web', name: 'Ada', password: 'example', details: undefined };
// @ts-expect-error The server supplies the primary key.
const withId: CreateInput<Account> = { ...input, id: 1 };
// @ts-expect-error A write-only password is required on create.
const missingPassword: CreateInput<Account> = { source: 'web', name: 'Ada', details: undefined };

type Batch = {
  data: WriteOnly<{ seats: number; team: readonly (Account | null)[] }>;
  allowed: Defaulted<CreateOnly<'a' | 'b' | null>>;
  choices: Editable<[Account, number]>;
  serverDefault: Defaulted<Readable<number>>;
};
expectTypeOf<CreateInput<Batch>>().toEqualTypeOf<{
  data: { seats: number; team: readonly (NewAccount | null)[] };
  allowed?: 'a' | 'b' | null;
  choices: [NewAccount, number];
}>();

type Guarded = CreateInput<{
  mixed: CreateOnly<string> | UpdateOnly<number>;
  sensitive: Editable<string> | Secret<Editable<number>>;
  neverSet: never;
  untyped: any;
  allowed: CreateOnly<'one'> | WriteOnly<'two'>;
}>;
expectTypeOf<Guarded>().toEqualTypeOf<{ allowed: 'one' | 'two' }>();
expectTypeOf<CreateInput<{ a: Editable<string> } | { b: Defaulted<WriteOnly<number>> }>>()
  .toEqualTypeOf<{ a: string } | { b?: number }>();
