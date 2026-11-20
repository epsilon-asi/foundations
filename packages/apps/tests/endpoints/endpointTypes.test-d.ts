import { expectTypeOf } from 'vitest';
import { z } from 'zod/v4';
import type { RequestOf, ResponseDataOf, ResponseTypeUnionOf } from '../../src/endpoints/endpointTypes.js';
import { responseTypeUnion } from '../../src/endpoints/responseTypeUnion.js';
import type { NotFoundFailureResponse } from '../../src/responses/notFoundFailure.js';
import { dateWireCodec } from '../../src/wire/date.js';

const reportData = z.strictObject({ id: z.string(), publishedAt: dateWireCodec.nullable() });
const GetReport = {
  Request: z.strictObject({ catalogId: z.string(), reportId: z.string(), asOf: dateWireCodec.optional() }),
  RequestContent: z.strictObject({ params: z.object({ catalogId: z.string(), reportId: z.string() }) }),
  ResponseData: reportData,
  Response: z.strictObject({ code: z.literal(200), data: reportData }),
};
const DeleteReport = { Request: z.strictObject({ reportId: z.string() }), ResponseData: undefined };
const Lookup = { ResponseTypeUnion: responseTypeUnion({ response: GetReport.Response, failures: [404] }) };

type GetRequest = RequestOf<typeof GetReport>;
type Report = ResponseDataOf<typeof GetReport>;
expectTypeOf<GetRequest>().toEqualTypeOf<{ catalogId: string; reportId: string; asOf?: Date | undefined }>();
expectTypeOf<Report>().toEqualTypeOf<{ id: string; publishedAt: Date | null }>();
expectTypeOf<RequestOf<typeof DeleteReport>>().toEqualTypeOf<{ reportId: string }>();
expectTypeOf<ResponseDataOf<typeof DeleteReport>>().toBeVoid();
expectTypeOf<ResponseTypeUnionOf<typeof Lookup>>().toEqualTypeOf<{ code: 200; data: Report } | NotFoundFailureResponse>();
// @ts-expect-error Requests use the decoded date.
const wireRequest: GetRequest = { catalogId: 'c', reportId: 'r', asOf: '2026-11-01T00:00:00Z' };
// @ts-expect-error The request does not contain the tenant header.
const withTenant: GetRequest = { catalogId: 'c', reportId: 'r', organizationId: 't' };
// @ts-expect-error Handlers return the payload itself.
const envelope: Report = { code: 200, data: { id: 'r', publishedAt: null } };

type Endpoint<Request extends z.ZodType, Data extends z.ZodType | undefined> = {
  readonly Request: Request;
  readonly ResponseData: Data;
};
const searchRequest = z.strictObject({ search: z.string() });
type TextEndpoint = Endpoint<typeof searchRequest, z.ZodString>;
expectTypeOf<RequestOf<TextEndpoint | typeof DeleteReport>>().toEqualTypeOf<{ search: string } | { reportId: string }>();
expectTypeOf<ResponseDataOf<TextEndpoint | typeof GetReport>>().toEqualTypeOf<string | Report>();
expectTypeOf<ResponseDataOf<typeof GetReport | typeof DeleteReport>>().toEqualTypeOf<Report>();
expectTypeOf<ResponseDataOf<Endpoint<z.ZodType, z.ZodNullable<z.ZodString> | undefined>>>().toEqualTypeOf<string | null>();
expectTypeOf<RequestOf<Endpoint<z.ZodType, undefined>>>().toBeUnknown();
expectTypeOf<ResponseDataOf<Endpoint<z.ZodType, z.ZodType | undefined>>>().toBeUnknown();
expectTypeOf<ResponseDataOf<Endpoint<z.ZodType, z.ZodUndefined>>>().toEqualTypeOf<undefined>();
expectTypeOf<ResponseDataOf<never>>().toBeNever();
// @ts-expect-error The request member must be a schema.
type InvalidRequest = RequestOf<{ Request: 'GetReport' }>;
// @ts-expect-error The response data member must be a schema or undefined.
type InvalidResponse = ResponseDataOf<{ ResponseData: 200 }>;
