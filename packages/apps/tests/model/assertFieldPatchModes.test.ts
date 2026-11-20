import { createTypeRegistry, defineTypeExtension } from '@epsilon-asi/foundation';
import { expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { crudRouteMetadata } from '../../src/endpoints/crudRouteMetadata.js';
import { assertFieldPatchModes } from '../../src/model/assertFieldPatchModes.js';
import { crudExtension } from '../../src/model/extensions/crud.js';
import { ResourceDefinitionError } from '../../src/model/ResourceDefinitionError.js';

const { Prop, resolve, fields } = createTypeRegistry().use(crudExtension);

it('checks inherited PATCH declarations at registry resolution and projection, using the most-derived declaration', () => {
  class Base {
    @Prop.string({ crud: { patch: 'merge' } }) note!: string;
  }
  class Memo extends Base {}
  class CorrectedMemo extends Base {
    @Prop.string({ crud: { patch: 'replace' } }) override note!: string;
  }

  expect(() => resolve(Memo)).toThrow(ResourceDefinitionError);
  expect(() => fields(Memo, { pick: ['note'] })).toThrow(/Memo\.note.*"merge".*object/);
  expect(fields(CorrectedMemo, { pick: ['note'] }).parse({ note: 'Revised' })).toEqual({ note: 'Revised' });
});

it('follows presence wrappers, records and codec outputs without running their defaults or decoders', () => {
  const initial = vi.fn(() => ({ city: 'Boston' }));
  const address = z.record(z.string(), z.string()).nullable().default(initial).readonly();
  const decode = vi.fn((text: string) => text.split(','));
  const tags = z.codec(z.string(), z.array(z.string()), { decode, encode: values => values.join(',') });
  class Contact {
    @Prop(address, { crud: { patch: 'merge' } }) address!: z.output<typeof address>;
    @Prop(tags.optional(), { crud: { patch: 'append' } }) tags?: string[];
  }
  class InvalidContact {
    @Prop(tags, { crud: { patch: 'merge' } }) tags!: string[];
  }

  expect(() => resolve(Contact)).not.toThrow();
  expect(() => resolve(InvalidContact)).toThrow(/InvalidContact\.tags.*"merge".*object/);
  expect(initial).not.toHaveBeenCalled();
  expect(decode).not.toHaveBeenCalled();
});

it('requires every non-nullish union branch to have the declared container shape', () => {
  const addresses = z.union([z.null(), z.object({ city: z.string() }), z.object({ zip: z.string() })]);
  const mixed = z.union([z.array(z.string()), z.string()]);
  class Contact {
    @Prop(addresses, { crud: { patch: 'merge' } }) address!: z.output<typeof addresses>;
  }
  class MixedContact {
    @Prop(mixed, { crud: { patch: 'append' } }) tags!: z.output<typeof mixed>;
  }
  expect(() => resolve(Contact)).not.toThrow();
  expect(() => resolve(MixedContact)).toThrow(/MixedContact\.tags.*"append".*array/);
});

it('keeps replacement valid on opaque schemas and never evaluates lazy targets while choosing a mode', () => {
  const target = vi.fn(() => z.string());
  const deferred = z.lazy(target);
  class Record {
    @Prop(deferred, { crud: 'editable' }) note!: string;
    @Prop(deferred, { crud: { patch: 'replace' } }) title!: string;
    @Prop(z.array(deferred), { crud: { patch: 'append' } }) words!: string[];
    @Prop(z.object({ value: deferred }), { crud: { patch: 'merge' } }) entry!: { value: string };
  }
  class Opaque {
    @Prop(deferred, { crud: { patch: 'merge' } }) value!: string;
  }

  expect(() => resolve(Record)).not.toThrow();
  expect(() => resolve(Opaque)).toThrow(/Opaque\.value.*"merge".*object/);
  expect(target).not.toHaveBeenCalled();
});

it('checks a model supplied directly to the CRUD declaration even when all routes are disabled', () => {
  const imported = createTypeRegistry().use(defineTypeExtension({ ...crudExtension, validateField: undefined }));
  class Report {
    @imported.Prop.string({ crud: { patch: 'append' } }) label!: string;
  }

  const model = imported.resolve(Report);
  expect(() => assertFieldPatchModes(model)).toThrow(/Report\.label.*"append".*array/);
  expect(() => crudRouteMetadata({
    ...model, operations: { Create: false, Get: false, Update: false, Delete: false, List: false },
  })).toThrow(ResourceDefinitionError);
});

it('rejects an unknown mode in supplied model metadata even when the field is an array', () => {
  class Report {
    @Prop(z.array(z.string())) tags!: string[];
  }
  const tags = resolve(Report).fields.get('tags')!;
  const fields = new Map([['tags', { ...tags, extensions: { crud: { patch: 'prepend' as const } } }]]);
  // @ts-expect-error Supplied model metadata from JavaScript can contain an unsupported mode.
  expect(() => assertFieldPatchModes({ name: 'Report', fields })).toThrow(/Report\.tags.*unknown PATCH mode "prepend"/);
});
