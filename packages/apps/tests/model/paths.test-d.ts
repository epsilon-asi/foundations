import { expectTypeOf } from 'vitest';
import type { Defaulted, Editable, Id, Readable, Secret, WriteOnly } from '../../src/model/access.js';
import type { Paths } from '../../src/model/paths.js';

declare const metadata: unique symbol;
declare abstract class RecordBase {
  id: Id<string>;
  createdAt: Readable<Date>;
  refresh(): void;
}
declare class Contact extends RecordBase {
  name: Editable<string>;
  manager?: Defaulted<Readable<Contact | null>>;
  address: Readable<{ city: Editable<string>; country?: { iso: string } }>;
  password: WriteOnly<string>;
  credentials: Secret<{ token: string }>;
  history: readonly Contact[];
  labels: Record<string, string>;
  format?(): string;
  static collection: string;
  [metadata]: string;
}

type ContactPath = Paths<Contact>;
expectTypeOf<Paths<typeof Contact>>().toEqualTypeOf<ContactPath>();
expectTypeOf<'id' | 'createdAt' | 'manager.id' | 'manager.manager.name'>().toExtend<ContactPath>();
expectTypeOf<'address.city' | 'address.country.iso' | 'password' | 'credentials.token'>().toExtend<ContactPath>();
expectTypeOf<Extract<ContactPath, 'refresh' | 'format' | 'collection' | 'manager.refresh'>>().toBeNever();
expectTypeOf<Extract<ContactPath, 'history.0' | 'history.length' | 'labels.key' | 'createdAt.getTime' | 'name.length'>>().toBeNever();
// @ts-expect-error A misspelled field is not a declared path.
const typo: ContactPath = 'manager.nmae';
// @ts-expect-error Recursing through the same relation still ends at three segments.
const pastDepth: ContactPath = 'manager.manager.manager.name';

type Data = {
  tuple: readonly [Contact, string];
  times: ReadonlyMap<string, Date>;
  tags: Set<string>;
  bytes: Uint8Array;
  pattern: RegExp;
  problem: Error;
  anything: any;
  uncertain: unknown;
  values: Record<`entry_${string}`, Contact>;
  notice: { name: string; message: string };
  nested: { 'a.b': string; finite: Record<'one' | 'two', number> };
};
expectTypeOf<Paths<Data>>().toEqualTypeOf<
  'tuple' | 'times' | 'tags' | 'bytes' | 'pattern' | 'problem' | 'anything' | 'uncertain' | 'values'
  | 'notice' | 'notice.name' | 'notice.message' | 'nested' | 'nested.finite' | 'nested.finite.one' | 'nested.finite.two'
>();
expectTypeOf<Paths<{ data: { left: string } | { right: number } | null }>>()
  .toEqualTypeOf<'data' | 'data.left' | 'data.right'>();
expectTypeOf<Paths<Record<string, Contact>>>().toBeNever();
