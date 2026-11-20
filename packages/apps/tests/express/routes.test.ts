import { expect, expectTypeOf, it } from 'vitest';
import { createRouteSystem } from '../../src/express/routes.js';
import { failure } from '../../src/responses/failure.js';
import { CreateTicket as discoveredTicket, declareTickets, resources as discoveryResources, routeSystem as discoverySystem } from './fixtures/app.js';

it('binds the original endpoint, instantiating each decorated class once per app', async () => {
  const { resources, CreateTicket } = declareTickets();
  const system = createRouteSystem();
  let instances = 0;
  @system.Routes()
  class Tickets {
    constructor() { instances++; }
    helper = { other: true };
    create = system.handler(CreateTicket, { handle(request) {
      expectTypeOf(request).toEqualTypeOf<{ title: string }>();
      return { title: request.title, id: '018f515e-0cca-7000-8000-000000000001' };
    } });
  }
  const opts = { endpoints: resources.declaredEndpoints, routes: [Tickets] };
  expect(Object.isFrozen(resources.declaredEndpoints)).toBe(true);
  expect(resources.roles).toEqual(['VIEWER', 'EDITOR']);
  expect(instances).toBe(0);
  const [one] = await system.resolve(opts);
  const [two] = await system.resolve(opts);
  expect(instances).toBe(2);
  expect(one.endpoint).toBe(CreateTicket);
  expect(two).not.toBe(one);
  if (false) {
    // @ts-expect-error CreateTicket requires a readable id and title in the response.
    system.handler(CreateTicket, { handle: request => ({ title: request.title }) });
  }
});

it('names a missing endpoint for an empty class list and a missing routes directory', async () => {
  const { resources } = declareTickets();
  const system = createRouteSystem();
  const endpoints = resources.declaredEndpoints;
  await expect(system.resolve({ endpoints, routes: [] })).rejects.toThrow('Missing handlers for: CreateTicket');
  await expect(system.resolve({ endpoints, entry: import.meta.url, routesDir: 'absent' })).rejects.toThrow('Missing handlers for: CreateTicket');
});

it('discovers exported classes in nested route modules beside the application entry', async () => {
  const options = { endpoints: discoveryResources.declaredEndpoints, entry: new URL('./fixtures/app.ts', import.meta.url) };
  const [first] = await discoverySystem.resolve(options);
  const [second] = await discoverySystem.resolve(options);
  expect(first.endpoint).toBe(discoveredTicket);
  expect(second.endpoint).toBe(discoveredTicket);
  expect(second).not.toBe(first);
});

it('rejects handlers for a different resource system even when names and paths match', async () => {
  const { resources } = declareTickets();
  const other = declareTickets();
  const system = createRouteSystem();
  @system.Routes()
  class OtherTickets {
    create = system.handler(other.CreateTicket, { handle: () => failure.notFound() });
  }
  await expect(system.resolve({ endpoints: resources.declaredEndpoints, routes: [OtherTickets] }))
    .rejects.toThrow('OtherTickets binds CreateTicket outside this API');
});

it('detects duplicate handlers and collisions between contracts before accepting requests', async () => {
  const { resources, CreateTicket } = declareTickets();
  const system = createRouteSystem();
  const binding = system.handler(CreateTicket, { handle: () => failure.notFound() });
  // @ts-expect-error Disabled operations have no endpoint to bind.
  expect(() => system.handler(undefined, { handle: () => failure.notFound() })).toThrow('enabled endpoint declaration');
  @system.Routes()
  class Duplicate {
    first = binding;
    second = binding;
  }
  @system.Routes()
  class One { create = binding; }
  @system.Routes()
  class Two { create = binding; }
  const endpoints = resources.declaredEndpoints;
  await expect(system.resolve({ endpoints, routes: [Duplicate] })).rejects.toThrow('Duplicate.second duplicates the handler for CreateTicket');
  await expect(system.resolve({ endpoints, routes: [One, Two] })).rejects.toThrow('Multiple handlers for CreateTicket');
  await expect(system.resolve({ endpoints: [...endpoints, declareTickets().CreateTicket], routes: [] }))
    .rejects.toThrow('duplicate route POST /tickets');
});

it('keeps defaults scoped to their routes class and permits an explicit field override', async () => {
  const { resources, CreateTicket } = declareTickets();
  const system = createRouteSystem();
  const first = system.handler(CreateTicket, { handle: () => failure.notFound() });
  const override = system.handler(CreateTicket, { handle: () => failure.notFound() });
  @system.Routes({ defaults: [[first]] })
  class Defaults {}
  @system.Routes({ defaults: [first] })
  class Override { create = override; }
  const endpoints = resources.declaredEndpoints;
  expect(await system.resolve({ endpoints, routes: [Defaults] })).toEqual([first]);
  expect(await system.resolve({ endpoints, routes: [Override] })).toEqual([override]);
  await expect(createRouteSystem().resolve({ endpoints, routes: [Defaults] })).rejects.toThrow('this system\'s @Routes()');
});
