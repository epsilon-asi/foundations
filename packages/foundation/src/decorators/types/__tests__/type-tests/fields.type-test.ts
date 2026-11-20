import { z } from 'zod/v4';
import { createTypeRegistry, fields, type FieldsOptions } from '../../../../index.js';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;

const registry = createTypeRegistry();
const { Prop } = registry;
class Entity {
  @Prop.string() key!: string;
  run() {}
}
class Entry extends Entity {
  @Prop.number({ default: 1 }) count!: number;
  @Prop.string({ optional: true }) note?: string;
}

const picked = registry.fields(Entry, { pick: ['key', 'note'] });
type Picked = Expect<Equal<z.output<typeof picked>, { key: string; note?: string | undefined }>>;
type ShapeKeys = Expect<Equal<keyof typeof picked.shape, 'key' | 'note'>>;
const omit = fields(registry.resolve(Entry), { omit: ['key', 'note'] });
type Omitted = Expect<Equal<z.output<typeof omit>, { count: number }>>;
z.decode(omit, {}); // The selected validator supplies a default.
const selection = { pick: ['count'] } as const satisfies FieldsOptions<Entry>;
const count = registry.fields(Entry, selection).extend({ reason: z.string() });
type Extended = Expect<Equal<z.output<typeof count>, { count: number; reason: string }>>;

declare const variableKeys: ('key' | 'count')[];
const dynamic = registry.fields(Entry, { pick: variableKeys });
type Dynamic = Expect<Equal<z.output<typeof dynamic>, { key?: string | undefined; count?: number | undefined }>>;
declare const variableKey: 'key' | 'note';
const partialOmit = fields(registry.resolve(Entry), { omit: [variableKey] });
type PartialOmit = Expect<Equal<z.output<typeof partialOmit>, { key?: string | undefined; note?: string | undefined; count: number }>>;

// @ts-expect-error The class's fields constrain every name in pick.
registry.fields(Entry, { pick: ['ky'] });
// @ts-expect-error Methods cannot be selected as data fields.
fields(registry.resolve(Entry), { omit: ['run'] });
// @ts-expect-error A selection has a single mode.
registry.fields(Entry, { pick: ['key'], omit: ['count'] });
// @ts-expect-error The selection must name a mode.
registry.fields(Entry, {});
// @ts-expect-error The derived object exposes only its selected fields.
picked.shape.count;
