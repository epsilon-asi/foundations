import { defineMiddleware, type AnyMiddleware, type ProvidedBy } from '@epsilon-asi/command-line';
import { expectTypeOf } from 'vitest';
import type { z } from 'zod';
import { failure, type Failure } from '../../../src/responses/failure.js';
import type { RequestOf, ResponseDataOf } from '../../../src/endpoints/endpointTypes.js';

// S0 substitutes the Phase 1.4 endpoint and Phase 2.3 binding. The middleware
// factory and the type that combines its contributions come from command-line.
type WireContent = { params: object; query: object; body: object; headers: object };

interface Endpoint<
  Request extends z.ZodType = z.ZodType,
  Data extends z.ZodType | undefined = z.ZodType | undefined,
> {
  readonly Name: string;
  readonly Kind: 'crud';
  readonly Method: 'post' | 'get' | 'delete';
  readonly Path: string;
  readonly Access: unknown;
  readonly Route: unknown;
  readonly Request: Request;
  readonly RequestContent: z.ZodType<WireContent>;
  readonly ResponseData: Data;
  readonly Response: z.ZodType;
  readonly ResponseTypeUnion: z.ZodType;
  toContent(request: z.output<Request>): WireContent;
  fromContent(content: WireContent): z.output<Request>;
  Call(request: z.output<Request>): Promise<unknown>;
}

type HandlerResult<E extends Endpoint> = ResponseDataOf<E> | Failure;
interface BoundHandler<E extends Endpoint = Endpoint> { readonly endpoint: E }
type HandlerSet = readonly BoundHandler[];
type MiddlewareList = readonly AnyMiddleware[];

declare function group<const GroupUse extends MiddlewareList = []>(options: { use?: GroupUse }): {
  handler<E extends Endpoint, const RouteUse extends MiddlewareList = []>(
    endpoint: E,
    options: {
      use?: RouteUse;
      handle: (
        request: RequestOf<E>,
        ctx: { traceId: string } & ProvidedBy<[...GroupUse, ...RouteUse]>,
      ) => HandlerResult<NoInfer<E>> | Promise<HandlerResult<NoInfer<E>>>;
    },
  ): BoundHandler<E>;
  Routes(options?: { defaults?: HandlerSet | readonly HandlerSet[] }): (
    target: abstract new () => object, context: ClassDecoratorContext,
  ) => void;
};

class Offering {}
declare function crudHandlers(resource: typeof Offering): HandlerSet;
type ReadOffering = { id: string; name: string };
declare const endpoints: {
  CreateOffering: Endpoint<z.ZodType<{ name: string }>, z.ZodType<ReadOffering>>;
  ListOfferings: Endpoint<z.ZodType<{ page: number }>, z.ZodType<{ offerings: ReadOffering[]; count: number }>>;
  DeleteOffering: Endpoint<z.ZodType<{ offeringId: string }>, undefined>;
};

const { CreateOffering, ListOfferings, DeleteOffering } = endpoints;
const organization = defineMiddleware({
  name: 'organization', handle: (_ctx, next) => next({ organization: { id: 'org-1' } }),
});
const checkQuota = defineMiddleware({
  name: 'quota', handle: (_ctx, next) => next({ quota: 3 }),
});
const offerings = group({ use: [organization] });

@offerings.Routes()
class OfferingRoutes {
  create = offerings.handler(CreateOffering, {
    use: [checkQuota],
    async handle(request, ctx) {
      expectTypeOf(request).toEqualTypeOf<{ name: string }>();
      expectTypeOf(ctx).not.toBeAny();
      expectTypeOf(ctx.traceId).toEqualTypeOf<string>();
      expectTypeOf(ctx.organization.id).toEqualTypeOf<string>();
      expectTypeOf(ctx.quota).toEqualTypeOf<number>();
      return { id: ctx.organization.id, name: request.name };
    },
  });

  list = offerings.handler(ListOfferings, {
    handle(request, ctx) {
      expectTypeOf(request.page).toEqualTypeOf<number>();
      expectTypeOf(ctx.organization.id).toEqualTypeOf<string>();
      // @ts-expect-error Only the create route uses checkQuota.
      void ctx.quota;
      return { offerings: [], count: 0 };
    },
  });

  delete = offerings.handler(DeleteOffering, { async handle() {} });
}

expectTypeOf<OfferingRoutes['create']['endpoint']>().toEqualTypeOf<typeof CreateOffering>();
const { Routes } = group({});
@Routes({ defaults: crudHandlers(Offering) })
class DefaultOfferingRoutes {}

offerings.handler(CreateOffering, { handle: () => failure.notFound() });
offerings.handler(CreateOffering, {
  // @ts-expect-error The declared response needs both id and name.
  async handle(request, ctx) { return { id: ctx.organization.id, title: request.name }; },
});
offerings.handler(CreateOffering, {
  // @ts-expect-error A parameterless handler must match the same response.
  handle: async () => 1,
});
offerings.handler(CreateOffering, {
  // @ts-expect-error This endpoint declares a response, so returning void is an error.
  async handle() {},
});
offerings.handler(DeleteOffering, {
  // @ts-expect-error An endpoint without a response cannot return success data.
  handle: () => ({ id: 'of-1', name: 'Book' }),
});
declare const eitherOperation: typeof CreateOffering | typeof DeleteOffering;
offerings.handler(eitherOperation, {
  // @ts-expect-error An unresolved endpoint may still require a response.
  async handle() {},
});
// @ts-expect-error Handlers require endpoint objects.
offerings.handler('CreateOffering', { handle: () => undefined });
// @ts-expect-error The generated endpoint collection has no misspelled member.
offerings.handler(endpoints.CreateOfferring, { handle: () => failure.notFound() });
