import { createTypeRegistry } from '@epsilon-asi/foundation';
import { expect, it } from 'vitest';
import { fieldMessageKeys } from '../../src/i18n/fieldMessageKeys.js';
import { uiExtension } from '../../src/model/extensions/ui.js';

it('derives the three default message keys from the resource and field names', () => {
  expect(fieldMessageKeys({ resource: 'Offering', field: 'name' })).toEqual({
    label: 'offering.name',
    placeholder: 'offering.name.placeholder',
    helperText: 'offering.name.helper',
  });
});

it.each(['label', 'placeholder', 'helperText'] as const)('overrides only the %s key', key => {
  const declared = { [key]: 'catalog.custom' };
  expect(fieldMessageKeys({ resource: 'Offering', field: 'name', ui: declared })).toEqual({
    label: 'offering.name',
    placeholder: 'offering.name.placeholder',
    helperText: 'offering.name.helper',
    ...declared,
  });
});

it('uses the declared model name and resolved UI hints from the registry', () => {
  const { Type, Prop, resolve } = createTypeRegistry().use(uiExtension);

  @Type({ name: 'ApiKey' })
  class Key {
    @Prop.string({ ui: { multiline: true, helperText: 'credentials.hint' } })
    displayName!: string;
  }

  const model = resolve(Key);
  const field = model.fields.get('displayName')!;
  expect(fieldMessageKeys({ resource: model.name, field: field.name, ui: field.extensions.ui })).toEqual({
    label: 'apiKey.displayName',
    placeholder: 'apiKey.displayName.placeholder',
    helperText: 'credentials.hint',
  });
});
