import assert from 'node:assert/strict';
import { createDecoratorRegistry } from '@epsilon-asi/foundation';
import manifest from '@epsilon-asi/foundation/package.json' with { type: 'json' };

assert.equal(manifest.type, 'module');
assert.equal(manifest.sideEffects, false);

type OfferingDecorators = {
  class: { resource: { metadata: string } };
  property: { field: { metadata: string; target: string } };
  method: {};
  accessor: {};
};

const registry = createDecoratorRegistry<OfferingDecorators>();
const Resource = registry.class('resource');
const Field = registry.for<{ name: string }>().property('field');

@Resource('offerings')
class Offering {
  @Field('name', 'display name')
  name = '';
}

const metadata = registry.read(Offering);
assert.equal(metadata.firstClass('resource')?.metadata, 'offerings');
const [field] = metadata.propertyRecords('field');
assert.equal(field.memberName, 'name');
assert.equal(field.metadata, 'display name');
