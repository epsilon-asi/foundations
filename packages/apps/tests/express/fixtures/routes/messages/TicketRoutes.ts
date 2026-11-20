import { CreateTicket, routeSystem } from '../../app.js';

@routeSystem.Routes()
export class TicketRoutes {
  create = routeSystem.handler(CreateTicket, {
    handle: request => ({ ...request, id: '018f515e-0cca-7000-8000-000000000001' }),
  });
}
