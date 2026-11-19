import { serialize, type EntityManager, type FilterQuery } from '@mikro-orm/core';
import { expectTypeOf } from 'vitest';
import { Offering, offeringSchema, resourceService, type EntityOf } from './offering.fixture.js';

declare const em: EntityManager;
const entity = offeringSchema();
const input = { name: 'Office', tags: ['team'], months: [3], details: { seats: 4 } };
const row = em.create(entity, { ...input, organizationId: 'a' });
expectTypeOf(row).toEqualTypeOf<EntityOf<typeof Offering>>();
const response = serialize(row);
// @ts-expect-error Unmarked providerId is hidden in MikroORM's serialized type.
void response.providerId;
// @ts-expect-error The required name column is missing.
em.create(entity, { organizationId: 'a', tags: [], months: [], details: { seats: 4 } });
// @ts-expect-error Assign must match the nested value type.
em.assign(row, { details: { seats: 'four' } });

const valid = { details: { seats: { $gte: 4 } }, tags: { $contains: ['team'] } } satisfies FilterQuery<EntityOf<typeof Offering>>;
void em.find(entity, valid);
// @ts-expect-error A numeric comparison needs a numeric operand.
void em.find(entity, { details: { seats: { $gte: 'four' } } });
const service = resourceService<typeof Offering>(entity);
service.create({ ctx: { em, organizationId: 'a' }, input });
// @ts-expect-error The organization is supplied by context.
service.create({ ctx: { em, organizationId: 'a' }, input: { ...input, organizationId: 'b' } });
