import { createTypeRegistry } from '@epsilon-asi/foundation';
import { expectTypeOf } from 'vitest';
import { uiExtension } from '../../src/model/extensions/ui.js';

const { Type, Prop, resolve } = createTypeRegistry().use(uiExtension);

@Type({ ui: { label: 'catalog.offering', plural: 'catalog.offerings' } })
class Offering {
  @Prop.string({ ui: { label: 'offering.name', order: 1 } })
  name!: string;
}

type FieldHints = {
  label?: string; placeholder?: string; helperText?: string;
  input?: string; autoComplete?: string; multiline?: boolean; order?: number;
};

const model = resolve(Offering);
expectTypeOf(model.extensions.ui).toEqualTypeOf<{ label?: string; plural?: string } | undefined>();
expectTypeOf(model.fields.get('name')?.extensions.ui).toEqualTypeOf<FieldHints | undefined>();
