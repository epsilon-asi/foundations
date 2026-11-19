import { expectTypeOf } from 'vitest';
import type { Editable, Fields, Id, IdOf } from '../../src/index.js';

declare const metadata: unique symbol;

declare abstract class Base {
  readonly key: Id<number>;
  label?: Editable<string | null>;
  refresh(): void;
}

declare class Contact extends Base {
  static collection: string;
  [metadata]: boolean;
  city: string;
  format?(locale: string): string;
}

type ContactFields = {
  readonly key: Id<number>;
  label?: Editable<string | null>;
  city: string;
};

expectTypeOf<Fields<Contact>>().toEqualTypeOf<ContactFields>();
expectTypeOf<Fields<typeof Contact>>().toEqualTypeOf<ContactFields>();
expectTypeOf<IdOf<Contact | { externalKey: Id<string> }>>().toEqualTypeOf<number | string>();
