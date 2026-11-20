import { z } from 'zod/v4';
import { createTypeRegistry, fields, TypeRegistryError } from '../../../index.js';

describe('fields', () => {
  const types = createTypeRegistry().use({ key: 'label' as const, field: z.string() });
  const { Type, Prop, resolve } = types;
  const quantity = z.codec(z.string().regex(/^\d+$/), z.int().nonnegative(), { decode: Number, encode: String });
  class CatalogRecord {
    @Prop.string({ min: 2, description: 'Catalog key', meta: { example: 'ab' } }) key!: string;
  }
  @Type({ name: 'Stock', mode: 'loose' })
  class StockItem extends CatalogRecord {
    @Prop(quantity, { label: 'units' }) units!: number;
    @Prop.string({ optional: true }) note?: string;
    @Prop.enum(['draft', 'live'], { default: 'draft' }) status!: 'draft' | 'live';
    transient?: string;
  }

  it('selects the original inherited and declared schemas in model order', () => {
    const projected = types.fields(StockItem, { pick: ['units', 'key', 'key'] });
    const model = resolve(StockItem);
    expect(Object.keys(projected.shape)).toEqual(['key', 'units']);
    expect(projected.shape.key).toBe(model.fields.get('key')?.schema);
    expect(projected.shape.key.meta()).toMatchObject({ description: 'Catalog key', example: 'ab' });
    expect(projected.shape.units).toBe(model.fields.get('units')?.schema);
    expect(z.decode(projected, { key: 'ab', units: '12' })).toEqual({ key: 'ab', units: 12 });
    expect(z.encode(projected, { key: 'ab', units: 12 })).toEqual({ key: 'ab', units: '12' });
    expect(projected.safeParse({ key: 'a', units: '12' }).error?.issues[0].path).toEqual(['key']);
    expect(projected.safeParse({ key: 'ab', units: '12', note: 'outside' }).success).toBe(false);
    expect(projected.extend({ owner: z.string() }).parse({ key: 'ab', units: '1', owner: 'Ada' })).toEqual({
      key: 'ab', units: 1, owner: 'Ada',
    });
  });

  it('omits inherited fields and preserves optional and defaulted fields', () => {
    const model = resolve(StockItem);
    const projected = fields(model, { omit: ['key', 'units'] });
    expect(Object.keys(projected.shape)).toEqual(['note', 'status']);
    expect(z.decode(projected, {})).toEqual({ status: 'draft' });
    expect(projected.safeParse({ key: 'ab' }).success).toBe(false);
    expect(projected.parse({ note: 'restocked', status: 'live' })).toEqual({ note: 'restocked', status: 'live' });
    expect(projected.safeParse({ status: 'other' }).error?.issues[0].path).toEqual(['status']);
    expect(fields(model, { pick: [] }).safeParse({ key: 'ab' }).success).toBe(false);
    expect(Object.keys(fields(model, { omit: [], pick: undefined }).shape)).toEqual([...model.fields.keys()]);
  });

  it('reports misspelled and undecorated properties during definition', () => {
    const model = resolve(StockItem);
    for (const name of ['unti', 'transient'] as const) {
      // @ts-expect-error An untyped caller can also misspell a field.
      expect(() => fields(model, { omit: [name] })).toThrow(expect.objectContaining({
        name: 'TypeRegistryError', typeName: 'Stock', field: name,
      }));
    }
  });

  it.each([undefined, null, {}, { pick: null }, { omit: 'units' }, { pick: ['key'], omit: [] }])(
    'requires exactly one pick or omit array for %p',
    invalid => {
      // @ts-expect-error JavaScript callers can pass a malformed selection.
      expect(() => types.fields(StockItem, invalid)).toThrow(TypeRegistryError);
    },
  );

  it('resolves a class only through its own registry', () => {
    const other = createTypeRegistry();
    expect(() => other.fields(StockItem, { pick: ['key'] })).toThrow(TypeRegistryError);
    expect(types.fields(StockItem, { pick: ['key'] }).parse({ key: 'ab' })).toEqual({ key: 'ab' });
  });
});
