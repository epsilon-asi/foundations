import { createTypeRegistry } from '@epsilon-asi/foundation';
import { expectTypeOf } from 'vitest';
import { crudExtension } from '../../src/model/extensions/crud.js';

const { Prop, resolve } = createTypeRegistry().use(crudExtension);

class Contact {
  @Prop.uuid({ crud: 'id' })
  id!: string;
}

type Preset = 'readable' | 'id' | 'tenant' | 'editable' | 'createOnly' | 'updateOnly' | 'writeOnly' | 'internal' | 'secret';
type Options = { access?: Preset; id?: boolean; patch?: 'replace' | 'merge' | 'append' };

const contact = resolve(Contact);
const metadata = contact.fields.get('id')?.extensions.crud;
expectTypeOf(metadata).toEqualTypeOf<Preset | Options | undefined>();
expectTypeOf(contact.extensions).not.toHaveProperty('crud');
