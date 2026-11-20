import { expectTypeOf } from 'vitest';
import { z } from 'zod/v4';
import {
  SUCCESS_CODES, dateWireCodec, responseTypeUnion, successResponseSchema,
  type EmptySuccessResponse, type ResponseOf, type ResponseTypeUnionOf, type SuccessResponse, type SuccessResponseSchemaOptions,
} from '../../src/index.js';

type Offering = { id: string };
const found: SuccessResponse<Offering> = { code: 200, data: { id: 'offering-1' } };
const created: SuccessResponse<Offering> = { code: SUCCESS_CODES.Created, data: found.data, message: 'offering.created' };
const deleted: EmptySuccessResponse = { code: 200 };
const deletedWithMessage: EmptySuccessResponse = { code: 200, message: 'offering.deleted' };
const emptyCreated: EmptySuccessResponse<201> = { code: 201 };

expectTypeOf(SUCCESS_CODES.Ok).toEqualTypeOf<200>();
expectTypeOf(SUCCESS_CODES.Created).toEqualTypeOf<201>();
expectTypeOf<SUCCESS_CODES>().toEqualTypeOf<200 | 201>();
expectTypeOf<SuccessResponse<Offering>['code']>().toEqualTypeOf<SUCCESS_CODES>();
type DataOf<Response> = Response extends SuccessResponse<infer Data> ? Data : never;
expectTypeOf<DataOf<typeof created>>().toEqualTypeOf<Offering>();
expectTypeOf(created.message).toEqualTypeOf<string | undefined>();
expectTypeOf(deleted.code).toEqualTypeOf<200>();
expectTypeOf(deletedWithMessage.message).toEqualTypeOf<string | undefined>();
expectTypeOf(emptyCreated.code).toEqualTypeOf<201>();

const populated = { code: SUCCESS_CODES.Ok, data: found.data } as const;
// @ts-expect-error Delete has no data even if the populated envelope comes from a variable.
const deleteWithData: EmptySuccessResponse = populated;
// @ts-expect-error Delete returns status 200.
const deleteWithCreatedCode: EmptySuccessResponse = { code: 201 };
// @ts-expect-error Get declares a read model and requires its data.
const getWithoutData: SuccessResponse<Offering> = deleted;

// @ts-expect-error The endpoint declares data, even when its payload may be null.
const missingData: SuccessResponse<Offering | null> = { code: 200 };
// @ts-expect-error A failure status cannot describe a success.
const failureCode: SuccessResponse<Offering> = { code: 404, data: found.data };
// @ts-expect-error A 204 No Content status is outside the success envelope contract.
const noContent: SUCCESS_CODES = 204;
// @ts-expect-error The payload must match the endpoint's declared data type.
const wrongData: SuccessResponse<Offering> = { code: 201, data: { id: 42 } };

const data = z.object({ published: dateWireCodec });
const create = successResponseSchema({ code: 201, data });
const endpoint = { Response: create, ResponseTypeUnion: responseTypeUnion({ response: create, failures: [409] }) };
expectTypeOf<z.input<typeof create>>().toEqualTypeOf<SuccessResponse<{ published: string }, 201>>();
expectTypeOf<ResponseOf<typeof endpoint>>().toEqualTypeOf<SuccessResponse<{ published: Date }, 201>>();
expectTypeOf<ResponseTypeUnionOf<typeof endpoint>['code']>().toEqualTypeOf<201 | 409>();
// @ts-expect-error The declared payload is required.
create.encode({ code: 201 });
// @ts-expect-error The codec accepts an ISO string on the wire.
create.decode({ code: 201, data: { published: new Date() } });
// @ts-expect-error The decoded success holds a Date.
create.encode({ code: 201, data: { published: '2026-01-02T12:00:00Z' } });

const remove = successResponseSchema({ code: 200 });
expectTypeOf<z.input<typeof remove>>().toEqualTypeOf<EmptySuccessResponse<200>>();
expectTypeOf<z.output<typeof remove>>().toEqualTypeOf<EmptySuccessResponse<200>>();
// @ts-expect-error An empty endpoint rejects payloads even on saved values.
remove.encode(populated);
// @ts-expect-error The endpoint's success code is 200.
remove.decode({ code: 201 });

declare const saved: SuccessResponseSchemaOptions<200, typeof data>;
const optional = successResponseSchema(saved);
expectTypeOf<z.input<typeof optional>>().toEqualTypeOf<SuccessResponse<{ published: string }, 200> | EmptySuccessResponse<200>>();
const optionalValue = successResponseSchema({ code: 200, data: z.string().optional() });
expectTypeOf<z.output<typeof optionalValue>>().toEqualTypeOf<SuccessResponse<string, 200>>();
// @ts-expect-error The outer data member is required even if its schema is optional.
optionalValue.decode({ code: 200 });
