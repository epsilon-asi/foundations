import { createTypeRegistry } from '@epsilon-asi/foundation';
import { expect, it } from 'vitest';
import { uiExtension } from '../../src/model/extensions/ui.js';

const { Type, Prop, resolve } = createTypeRegistry().use(uiExtension);

it('resolves the resource labels and field hints independently', () => {
  const resource = { label: 'catalog.offering', plural: 'catalog.offerings' };
  const field = {
    label: 'offering.name', placeholder: 'offering.name.placeholder', helperText: 'offering.name.helper',
    input: 'text', autoComplete: 'off', multiline: false, order: 0,
  };

  @Type({ ui: resource })
  class Offering {
    @Prop.string({ ui: field }) name!: string;
    @Prop.string({ ui: {} }) note!: string;
    @Prop.string() status!: string;
  }

  const model = resolve(Offering);
  expect(model.extensions.ui).toEqual(resource);
  expect(model.fields.get('name')?.extensions.ui).toEqual(field);
  expect(model.fields.get('note')?.extensions.ui).toEqual({});
  expect(model.fields.get('status')?.extensions.ui).toBeUndefined();
});

it('preserves missing model options and records field hints without text overrides', () => {
  class Offering {
    @Prop.string({ ui: { multiline: true } }) description!: string;
  }

  const model = resolve(Offering);
  expect(model.extensions.ui).toBeUndefined();
  expect(model.fields.get('description')?.extensions.ui).toEqual({ multiline: true });
});

it.each([
  { plural: 'catalog.offerings' }, { options: { DRAFT: 'status.draft' } }, { order: 'first' },
  { multiline: 'true' }, { label: 42 },
])('rejects invalid field hints %j', ui => {
  class Offering {
    // @ts-expect-error Exercises runtime validation of unchecked metadata.
    @Prop.string({ ui }) name!: string;
  }

  expect(() => resolve(Offering)).toThrow('Invalid "ui" options on field "name"');
});

it.each([{ placeholder: 'offering.name.placeholder' }, { plural: 3 }])('rejects invalid model labels %j', ui => {
  // @ts-expect-error Exercises runtime validation of unchecked metadata.
  @Type({ ui })
  class Offering {}

  expect(() => resolve(Offering)).toThrow('Invalid "ui" options on Offering');
});
