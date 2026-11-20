import { defineEntity, type EntityOf } from '@epsilon-asi/apps/mikro-orm';
import { serialize, type EntityManager } from '@mikro-orm/core';
import { expectTypeOf } from 'vitest';
import { Offering, OfferingType } from '../../examples/crud-api/common/src/resources/Offering.js';

declare const em: EntityManager;
const entity = defineEntity(Offering);
const values = {
  id: 'id', organizationId: 'organization', name: 'Name', description: '', type: OfferingType.Product,
  vectorStoreId: 'internal', createdAt: new Date(), updatedAt: new Date(),
};
const row = em.create(entity, values);
expectTypeOf(row).toEqualTypeOf<EntityOf<typeof Offering>>();
expectTypeOf(serialize(row).links).toMatchTypeOf<string[]>();
// @ts-expect-error The database row contains vectorStoreId, but the DTO hides it.
void serialize(row).vectorStoreId;
// @ts-expect-error A required field must be present.
em.create(entity, { name: 'Missing fields' });
// @ts-expect-error OfferingType is a finite set of values.
em.create(entity, { ...values, type: 'unknown' });
