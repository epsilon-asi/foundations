import { createRouteSystem } from '../../../src/express/routes.js';
import type { Editable, Id } from '../../../src/model/access.js';
import { createResourceSystem } from '../../../src/model/createResourceSystem.js';

export function declareTickets() {
  const resources = createResourceSystem({ roles: ['VIEWER', 'EDITOR'] });
  const { Resource, Prop, endpoints } = resources;
  @Resource()
  class Ticket {
    @Prop.uuid({ crud: 'id' }) id!: Id<string>;
    @Prop.string({ crud: 'editable' }) title!: Editable<string>;
  }
  const { CreateTicket } = endpoints(Ticket, {
    name: 'Ticket', operations: { Get: false, Update: false, Delete: false, List: false },
  });
  return { resources, CreateTicket };
}

export const { resources, CreateTicket } = declareTickets();
export const routeSystem = createRouteSystem();
