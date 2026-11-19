import { createDecoratorRegistry } from '@epsilon-asi/foundation';
import { expect, it } from 'vitest';

it('reads class and field metadata from standard decorators', () => {
  const registry = createDecoratorRegistry<{
    class: { resource: { metadata: string } };
    property: { field: { metadata: string; target: string } };
    method: {};
    accessor: {};
  }>();
  const Resource = registry.class('resource');
  const Field = registry.for<{ name: string }>().property('field');

  @Resource('offerings')
  class Offering {
    @Field('display name')
    name = '';
  }

  const metadata = registry.read(Offering);
  expect(metadata.firstClass('resource')?.metadata).toBe('offerings');
  expect(metadata.propertyRecords('field')).toMatchObject([
    { memberName: 'name', metadata: 'display name' },
  ]);
});
