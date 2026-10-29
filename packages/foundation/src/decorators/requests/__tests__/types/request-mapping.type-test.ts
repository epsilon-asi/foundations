import {
  AutoMap,
  Body,
  Header,
  MappedRequest,
  Param,
  Query,
  type RequestContents,
} from '../../mapping';

class GoodRequest extends MappedRequest<RequestContents> {
  @Param('organizationId')
  organizationId!: string;

  @Param.number('campaignNumber')
  campaignNumber!: number;

  @Query.boolean('includeArchived')
  includeArchived!: boolean;

  @Body.date('createdAt')
  createdAt!: Date;

  @Body('payload')
  payload!: { name: string };

  @Header('x-request-id')
  requestId!: string | undefined;

  @AutoMap({ query: true, type: 'number' })
  page!: number;
}

class BadRequest {
  // @ts-expect-error @Param() defaults to string fields
  @Param('organizationId')
  organizationId!: number;

  // @ts-expect-error number mapping requires a number field
  @Param.number('campaignNumber')
  campaignNumber!: string;

  // @ts-expect-error boolean mapping requires a boolean field
  @Query.boolean('includeArchived')
  includeArchived!: string;

  // @ts-expect-error date mapping requires a Date field
  @Body.date('createdAt')
  createdAt!: string;

  // @ts-expect-error header defaults to string fields
  @Header('x-request-id')
  requestId!: number;

  // @ts-expect-error number default must be a number
  @Query.number('page', { default: '1' })
  page!: number;

  // @ts-expect-error boolean default must be a boolean
  @Query.boolean('enabled', { default: 'true' })
  enabled!: boolean;

  // @ts-expect-error string default must be a string
  @Param.string('id', { default: 123 })
  id!: string;

  // @ts-expect-error AutoMap number mapping requires a number field
  @AutoMap({ query: true, type: 'number' })
  autoMappedPage!: string;
}
