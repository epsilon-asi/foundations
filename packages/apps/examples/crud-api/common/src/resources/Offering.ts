import type { CreateOnly, Defaulted, Editable, Id, Readable, Tenant } from '@epsilon-asi/apps';
import { z } from 'zod/v4';
import { endpoints, Prop, Resource } from '../app.js';

export enum OfferingType {
  Product = 'PRODUCT',
  Service = 'SERVICE',
}

export enum OfferingStatus {
  Draft = 'DRAFT',
  Active = 'ACTIVE',
  Archived = 'ARCHIVED',
}

@Resource()
export class Offering {
  @Prop.uuid({ crud: 'id' }) id!: Id<string>;
  @Prop.uuid({ crud: 'tenant' }) organizationId!: Tenant<string>;
  @Prop.string({ crud: 'editable', min: 1 }) name!: Editable<string>;
  @Prop.string({ crud: 'editable', ui: { multiline: true } }) description!: Editable<string>;
  @Prop(z.array(z.url()).default([]), { crud: 'editable' }) links!: Defaulted<Editable<string[]>>;
  @(Prop.enum(OfferingType, { crud: 'createOnly' })) type!: CreateOnly<OfferingType>;
  @(Prop.enum(OfferingStatus, { crud: 'readable', default: OfferingStatus.Draft }))
  status!: Defaulted<Readable<OfferingStatus>>;
  @Prop.string() vectorStoreId!: string;
  @Prop.date({ crud: 'readable' }) createdAt!: Readable<Date>;
  @Prop.date({ crud: 'readable' }) updatedAt!: Readable<Date>;
}

export const { CreateOffering, GetOffering, UpdateOffering, DeleteOffering, ListOfferings } = endpoints(Offering, {
  name: 'Offering',
  operations: { Create: true, Update: true, Delete: true },
  list: { filter: { type: ['$eq'] }, sort: ['name', 'createdAt'] },
  access: { read: 'VIEWER', write: 'EDITOR', delete: 'ADMINISTRATOR' },
});
