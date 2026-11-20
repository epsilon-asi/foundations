import { newId, type RequestOf, type ResponseDataOf, type SortDirection, type UpdateInput } from '@epsilon-asi/apps';
import type { HttpContext } from '@epsilon-asi/apps/express';
import { type CreateOffering, type ListOfferings, type Offering, OfferingStatus } from '../../common/src/resources/Offering.js';

/** The example handler's stored row. Access grants determine which fields reach the client. */
export function exampleOffering(request: RequestOf<typeof CreateOffering>, organizationId: string) {
  const now = new Date();
  return {
    ...request, id: newId(), organizationId, status: OfferingStatus.Draft,
    vectorStoreId: newId(), createdAt: now, updatedAt: now,
  };
}

type StoredOffering = ReturnType<typeof exampleOffering>;
type FoundOffering = StoredOffering | null | undefined;

interface OfferingLookup {
  ctx: HttpContext;
  id: StoredOffering['id'];
}

interface OfferingUpdate extends OfferingLookup {
  patch: UpdateInput<typeof Offering>;
}

interface OfferingList {
  ctx: HttpContext;
  query: RequestOf<typeof ListOfferings>;
}
type OfferingPage = ResponseDataOf<typeof ListOfferings>;
type OfferingSortField = keyof NonNullable<OfferingList['query']['orderBy']> | 'id';

/** The contract validates the keys and preserves their priority. ID breaks any remaining ties. */
export function offeringOrder(orderBy: OfferingList['query']['orderBy']) {
  return Object.entries({ ...orderBy, id: 'asc' }) as [OfferingSortField, SortDirection][];
}

export interface OfferingStorage {
  save(options: { ctx: HttpContext; row: StoredOffering }): StoredOffering | Promise<StoredOffering>;
  get(options: OfferingLookup): FoundOffering | Promise<FoundOffering>;
  list(options: OfferingList): OfferingPage | Promise<OfferingPage>;
  update(options: OfferingUpdate): FoundOffering | Promise<FoundOffering>;
  delete(options: OfferingLookup): boolean | Promise<boolean>;
}

/** One store per routes instance, keyed by organization and offering ID. */
export class OfferingStore implements OfferingStorage {
  private readonly organizations = new Map<string, Map<string, StoredOffering>>();

  save({ row }: { row: StoredOffering }): StoredOffering {
    let offerings = this.organizations.get(row.organizationId);
    if (!offerings) {
      offerings = new Map();
      this.organizations.set(row.organizationId, offerings);
    }
    offerings.set(row.id, row);
    return row;
  }

  get({ ctx, id }: OfferingLookup): StoredOffering | undefined {
    return this.organizations.get(ctx.tenant.id)?.get(id);
  }

  list({ ctx, query: { page, perPage, where, orderBy } }: OfferingList): OfferingPage {
    const bucket = this.organizations.get(ctx.tenant.id);
    if (!bucket) return { offerings: [], count: 0 };
    const offset = page * perPage;
    const rows = [...bucket.values()].filter(row => !where?.type || row.type === where.type.$eq);
    const order = offeringOrder(orderBy);
    rows.sort((a, b) => {
      for (const [field, direction] of order) {
        // PostgreSQL uses bytewise text ordering for names and native ordering for UUIDs and dates.
        const comparison = field === 'createdAt' ? a.createdAt.getTime() - b.createdAt.getTime()
          : Buffer.compare(Buffer.from(a[field]), Buffer.from(b[field]));
        if (comparison) return direction === 'asc' ? comparison : -comparison;
      }
      return 0;
    });
    return { offerings: rows.slice(offset, offset + perPage), count: rows.length };
  }

  update({ ctx, id, patch }: OfferingUpdate): StoredOffering | undefined {
    const row = this.get({ ctx, id });
    if (row) return this.save({ row: { ...row, ...patch } });
  }

  delete({ ctx, id }: OfferingLookup): boolean {
    const offerings = this.organizations.get(ctx.tenant.id);
    if (!offerings?.delete(id)) return false;
    if (offerings.size === 0) this.organizations.delete(ctx.tenant.id);
    return true;
  }
}
