import { expectTypeOf } from 'vitest';
import type {
  CreateOnly, Defaulted, Editable, Id, Internal, Readable, ReadModel, Secret, Tenant, UpdateOnly, WriteOnly,
} from '../../src/index.js';

declare class Base {
  readonly key: Id<number>;
  organizationId: Tenant<string>;
  refresh(): void;
}

declare class Contact extends Base {
  name: Editable<string>;
  source: CreateOnly<'web' | 'phone'>;
  revision: UpdateOnly<number>;
  lastSeen?: Defaulted<Readable<Date | null>>;
  manager?: Readable<Contact | null>;
  password: WriteOnly<string>;
  memo: Internal<string>;
  credential: Secret<string>;
  hidden: boolean;
}

type PublicContact = {
  readonly key: number;
  organizationId: string;
  name: string;
  source: 'web' | 'phone';
  revision: number;
  lastSeen?: Date | null;
  manager?: PublicContact | null;
};

expectTypeOf<ReadModel<Contact>>().toEqualTypeOf<PublicContact>();
expectTypeOf<ReadModel<typeof Contact>>().toEqualTypeOf<PublicContact>();

declare class Hidden {
  privateValue: string;
}

type Offering = {
  contacts: Readable<readonly (Contact | null)[]>;
  details: Editable<{ seats: number; team: Contact[]; owner: Hidden }>;
  restricted: Readable<{ pin: Secret<string>; note: string }>;
  codes: Readable<readonly ['local', number]>;
  wrapped: Readable<Defaulted<'ready'>>;
  metadata: any;
};

expectTypeOf<ReadModel<Offering>>().toEqualTypeOf<{
  contacts: readonly (PublicContact | null)[];
  details: { seats: number; team: PublicContact[]; owner: {} };
  restricted: {};
  codes: readonly ['local', number];
  wrapped: 'ready';
}>();

type Contacts = ReadModel<{ data: Readable<Contact | { label: Readable<string>; hidden: string }> }>;
expectTypeOf<Contacts['data']>().toEqualTypeOf<PublicContact | { label: string }>();
expectTypeOf<ReadModel<{ a: Readable<string> } | { b: Readable<number> }>>()
  .toEqualTypeOf<{ a: string } | { b: number }>();

type Guarded = ReadModel<{
  ambiguous: Readable<string> | Secret<Readable<number>>;
  unmarked: never;
  wrapped: Readable<Readable<string>>;
  secrets: Readable<Secret<string>[]>;
  unknowns: Readable<any[]>;
}>;
expectTypeOf<Guarded>().toEqualTypeOf<{ wrapped: string; secrets: never[]; unknowns: unknown[] }>();
