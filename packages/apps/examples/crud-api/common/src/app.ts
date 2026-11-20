import { createResourceSystem, type Id } from '@epsilon-asi/apps';

export const resources = createResourceSystem({
  tenant: () => Organization,
  roles: ['VIEWER', 'EDITOR', 'ADMINISTRATOR', 'OWNER'],
});
export const { Resource, Prop, endpoints } = resources;

// Tenant headers retain this spelling in minified clients.
@Resource({ name: 'Organization' })
export class Organization {
  @Prop.uuid({ crud: 'id' }) id!: Id<string>;
}
