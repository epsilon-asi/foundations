import {
  AutoMap,
  Body,
  CleanRequestObject,
  Header,
  MappedRequest,
  Param,
  Query,
  RequestMappingError,
  assignRequestContents,
  createRequestMapper,
  getAutoMapMeta,
  getRequestMappingDefinitions,
  objectToRequestContents,
  requestContentsToObject,
  type RequestContents,
} from '../../mapping';

describe('request mapping decorator system', () => {
  it('maps request params, query, body, and headers into a flat request object', () => {
    class CampaignRequest extends MappedRequest {
      @Param('organizationId')
      organizationId!: string;

      @Param('campaignId')
      campaignId!: string;

      @Query.number('page')
      page!: number;

      @Query.boolean('includeArchived')
      includeArchived!: boolean;

      @Body.date('createdAt')
      createdAt!: Date;

      @Body('title')
      title!: string;

      @Header('x-request-id')
      requestId!: string;
    }

    const request = new CampaignRequest({
      params: {
        organizationId: 'org_123',
        campaignId: 'cmp_456',
      },
      query: {
        page: '2',
        includeArchived: 'true',
      },
      body: {
        createdAt: '2026-05-23T12:00:00.000Z',
        title: 'Launch campaign',
      },
      headers: {
        'x-request-id': 'req_abc',
      },
    });

    expect(request.organizationId).toBe('org_123');
    expect(request.campaignId).toBe('cmp_456');
    expect(request.page).toBe(2);
    expect(request.includeArchived).toBe(true);
    expect(request.createdAt.toISOString()).toBe('2026-05-23T12:00:00.000Z');
    expect(request.title).toBe('Launch campaign');
    expect(request.requestId).toBe('req_abc');
  });

  it('maps a flat request object back into request contents', () => {
    class CampaignRequest extends MappedRequest {
      @Param('organizationId')
      organizationId!: string;

      @Param('campaignId')
      campaignId!: string;

      @Query.number('page')
      page!: number;

      @Query.boolean('includeArchived')
      includeArchived!: boolean;

      @Body('name')
      name!: string;
    }

    const request = CampaignRequest.create({
      organizationId: 'org_123',
      campaignId: 'cmp_456',
      page: 3,
      includeArchived: false,
      name: 'Spring launch',
    });

    const contents = request.destruct();

    expect(contents).toStrictEqual({
      params: {
        organizationId: 'org_123',
        campaignId: 'cmp_456',
      },
      body: {
        name: 'Spring launch',
      },
      query: {
        page: 3,
        includeArchived: false,
      },
      headers: {},
    });
  });

  it('can serialize params, query, and headers for browser/http request usage', () => {
    class CampaignRequest extends MappedRequest {
      @Param('organizationId')
      organizationId!: string;

      @Query.number('page')
      page!: number;

      @Query.boolean('includeArchived')
      includeArchived!: boolean;

      @Header('x-attempt')
      attempt!: string;

      @Body.date('createdAt')
      createdAt!: Date;
    }

    const request = CampaignRequest.create({
      organizationId: 'org_123',
      page: 10,
      includeArchived: true,
      attempt: 'first',
      createdAt: new Date('2026-05-23T12:00:00.000Z'),
    });

    const contents = objectToRequestContents(request, { serialize: 'http' });

    expect(contents.params).toStrictEqual({ organizationId: 'org_123' });
    expect(contents.query).toStrictEqual({ page: '10', includeArchived: 'true' });
    expect(contents.headers).toStrictEqual({ 'x-attempt': 'first' });
    expect(contents.body).toStrictEqual({ createdAt: new Date('2026-05-23T12:00:00.000Z') });
  });

  it('supports direct helper functions without extending MappedRequest', () => {
    class SearchRequest {
      @Query.number('page')
      page!: number;

      @Query.number('perPage')
      perPage!: number;

      @Body('term')
      term!: string;
    }

    const flat = requestContentsToObject(SearchRequest, {
      query: {
        page: '1',
        perPage: '25',
      },
      body: {
        term: 'campaign',
      },
    });

    expect(flat.page).toBe(1);
    expect(flat.perPage).toBe(25);
    expect(flat.term).toBe('campaign');

    flat.page = 2;
    expect(objectToRequestContents(flat).query).toStrictEqual({ page: 2, perPage: 25 });
  });

  it('supports @AutoMap compatibility wrappers', () => {
    class LegacyRequest extends MappedRequest {
      @AutoMap({ param: true })
      id!: string;

      @AutoMap({ query: true, type: 'number' })
      page!: number;

      @AutoMap({ body: true, name: 'display_name' })
      displayName!: string;
    }

    const request = new LegacyRequest({
      params: { id: 'abc' },
      query: { page: '4' },
      body: { display_name: 'Ray' },
    });

    expect(request.id).toBe('abc');
    expect(request.page).toBe(4);
    expect(request.displayName).toBe('Ray');

    const meta = getAutoMapMeta(LegacyRequest);
    expect(meta.params.id.key).toBe('id');
    expect(meta.query.page.dataType).toBe('number');
    expect(meta.body.displayName.sourceKey).toBe('display_name');
  });

  it('supports aliases through options objects', () => {
    class AliasRequest extends MappedRequest {
      @Param({ name: 'organization_id' })
      organizationId!: string;

      @Body({ name: 'campaign_name' })
      campaignName!: string;
    }

    const request = new AliasRequest({
      params: { organization_id: 'org_123' },
      body: { campaign_name: 'Launch' },
    });

    expect(request.organizationId).toBe('org_123');
    expect(request.campaignName).toBe('Launch');
    expect(request.destruct().params).toStrictEqual({ organization_id: 'org_123' });
    expect(request.destruct().body).toStrictEqual({ campaign_name: 'Launch' });
  });

  it('supports defaults and optional missing values', () => {
    class DefaultsRequest extends MappedRequest {
      @Query.number('page', { default: 1 })
      page!: number;

      @Query.number('perPage', { default: 50 })
      perPage!: number;

      @Query.boolean('includeArchived', { default: false })
      includeArchived!: boolean;

      @Header('x-request-id', { required: false })
      requestId!: string | undefined;
    }

    const request = new DefaultsRequest({ query: {} });

    expect(request.page).toBe(1);
    expect(request.perPage).toBe(50);
    expect(request.includeArchived).toBe(false);
    expect(request.requestId).toBeUndefined();
  });

  it('throws for missing required values', () => {
    class RequiredRequest extends MappedRequest {
      @Param('organizationId', { required: true })
      organizationId!: string;
    }

    expect(() => new RequiredRequest({ params: {} })).toThrow('organizationId');
  });

  it('throws for invalid coercions', () => {
    class InvalidRequest extends MappedRequest {
      @Query.number('page', { integer: true })
      page!: number;

      @Query.boolean('enabled')
      enabled!: boolean;

      @Body.date('createdAt')
      createdAt!: Date;
    }

    expect(() => new InvalidRequest({ query: { page: '1.5' } })).toThrow('integer');
    expect(() => new InvalidRequest({ query: { page: '1', enabled: 'maybe' } })).toThrow('boolean');
    expect(() => new InvalidRequest({ query: { page: '1', enabled: 'true' }, body: { createdAt: 'nope' } })).toThrow(
      'valid date',
    );
  });

  it('supports number min and max validation', () => {
    class PageRequest extends MappedRequest {
      @Query.number('page', { min: 1, max: 10 })
      page!: number;
    }

    expect(() => new PageRequest({ query: { page: '0' } })).toThrow('>= 1');
    expect(() => new PageRequest({ query: { page: '11' } })).toThrow('<= 10');

    const valid = new PageRequest({ query: { page: '5' } });
    expect(valid.page).toBe(5);
  });

  it('includes inherited mappings by default and can read own-only mappings', () => {
    class BaseRequest extends MappedRequest {
      @Param('organizationId')
      organizationId!: string;
    }

    class ChildRequest extends BaseRequest {
      @Body('name')
      name!: string;
    }

    const request = new ChildRequest({
      params: { organizationId: 'org_123' },
      body: { name: 'Campaign' },
    });

    expect(request.organizationId).toBe('org_123');
    expect(request.name).toBe('Campaign');

    const inherited = getRequestMappingDefinitions(ChildRequest);
    const ownOnly = getRequestMappingDefinitions(ChildRequest, { includeInherited: false });

    expect(inherited).toHaveLength(2);
    expect(ownOnly).toHaveLength(1);
    expect(ownOnly[0].propertyName).toBe('name');
  });

  it('throws when mapped fields are static by default', () => {
    class StaticRequest {
      @Param('id')
      static id: string;
    }

    expect(() => assignRequestContents(new StaticRequest(), { params: { id: 'abc' } })).toThrow('static');
  });

  it('can opt out of static rejection for unusual migration cases', () => {
    class StaticRequest {
      @Param('id')
      static id: string;
    }

    const instance = new StaticRequest();
    assignRequestContents(instance, { params: { id: 'abc' } }, { rejectStatic: false });

    expect((instance as unknown as { id: string }).id).toBe('abc');
  });

  it('supports isolated mapper instances', () => {
    const mapper = createRequestMapper({ namespace: 'isolated-request-mapper' });

    class LocalRequest extends MappedRequest {
      @mapper.Param('id')
      id!: string;
    }

    const local = mapper.requestContentsToObject(LocalRequest, { params: { id: 'local' } });
    expect(local.id).toBe('local');
    expect(getRequestMappingDefinitions(LocalRequest)).toHaveLength(0);
  });

  it('produces clean flat request objects', () => {
    class CleanableRequest extends MappedRequest {
      @Param('id')
      id!: string;

      @Body('name')
      name!: string;
    }

    const request = new CleanableRequest({ params: { id: 'abc' }, body: { name: 'Ray' } });
    expect(CleanRequestObject(request)).toStrictEqual({ id: 'abc', name: 'Ray' });
  });

  it('exercises alternate coercion branches and preserves defaults safely', () => {
    const defaultDate = new Date('2026-05-23T00:00:00.000Z');

    class EdgeRequest extends MappedRequest {
      @Param.string('id')
      id!: string;

      @Query.string('when')
      when!: string;

      @Body.number('truthy')
      truthy!: number;

      @Body.number('falsy')
      falsy!: number;

      @Query.boolean('fromOne')
      fromOne!: boolean;

      @Query.boolean('fromZero')
      fromZero!: boolean;

      @Query.boolean('fromNo')
      fromNo!: boolean;

      @Body.date('createdAt')
      createdAt!: Date;

      @Body.date('defaultDate', { default: defaultDate })
      defaultDate!: Date;

      @Body({ name: 'payload', default: { role: 'user' } })
      payload!: { role: string };
    }

    const request = new EdgeRequest({
      params: { id: 123 },
      query: {
        when: new Date('2026-05-23T12:00:00.000Z'),
        fromOne: 1,
        fromZero: 0,
        fromNo: 'no',
      },
      body: {
        truthy: true,
        falsy: false,
        createdAt: 1772323200000,
      },
    });

    expect(request.id).toBe('123');
    expect(request.when).toBe('2026-05-23T12:00:00.000Z');
    expect(request.truthy).toBe(1);
    expect(request.falsy).toBe(0);
    expect(request.fromOne).toBe(true);
    expect(request.fromZero).toBe(false);
    expect(request.fromNo).toBe(false);
    expect(request.createdAt.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(request.defaultDate.toISOString()).toBe(defaultDate.toISOString());
    expect(request.defaultDate === defaultDate).toBe(false);
    expect(request.payload).toStrictEqual({ role: 'user' });
  });

  it('throws for unsupported raw value types', () => {
    class BadRawRequest extends MappedRequest {
      @Query.number('page')
      page!: number;

      @Body.date('createdAt')
      createdAt!: Date;
    }

    expect(() => new BadRawRequest({ query: { page: {} } })).toThrow('number-compatible');
    expect(() => new BadRawRequest({ query: { page: 1 }, body: { createdAt: {} } })).toThrow('date-compatible');
  });

  it('supports includeUndefined false and serializes non-body dates for http mode', () => {
    class OptionalRequest extends MappedRequest {
      @Query('search')
      search!: string | undefined;

      @Query.date('createdAt')
      createdAt!: Date;
    }

    const request = OptionalRequest.create({
      createdAt: new Date('2026-05-23T12:00:00.000Z'),
    });

    const contents = request.destruct({ includeUndefined: false, serialize: 'http' });
    expect(contents.query).toStrictEqual({ createdAt: '2026-05-23T12:00:00.000Z' });
  });

  it('keeps field initializer defaults when no constructor request is supplied', () => {
    class NoPendingRequest extends MappedRequest {
      @Param('id')
      id = 'default-id';
    }

    const request = new NoPendingRequest();
    expect(request.id).toBe('default-id');
  });

  it('throws for invalid AutoMap section declarations', () => {
    expect(() => AutoMap({})).toThrow('exactly one');
    expect(() => AutoMap({ param: true, query: true })).toThrow('exactly one');
  });

  it('throws when mapping metadata uses a symbol member key', () => {
    const key = Symbol('secret');

    class SymbolRequest {
      @Body()
      [key]!: string;
    }

    expect(() => getRequestMappingDefinitions(SymbolRequest)).toThrow('symbol');
  });

  it('records optional class-level request object metadata and supports custom mapper options', () => {
    const mapper = createRequestMapper({ namespace: 'request-object-meta', allowPrivateMembers: true });

    @mapper.RequestObject({ description: 'Campaign request' })
    class CampaignRequest {
      @mapper.Param('id')
      id!: string;
    }

    const classRecord = mapper.registry.read(CampaignRequest).firstClass('requestObject');
    expect(classRecord?.metadata).toStrictEqual({ description: 'Campaign request' });
  });

  it('supports validateWith without depending on a Node-only validation package', async () => {
    class ValidateRequest extends MappedRequest {
      @Param('id')
      id!: string;
    }

    const request = new ValidateRequest({ params: { id: 'abc' } });
    const errors = await request.validateWith((value) => (value.id === 'abc' ? [] : ['bad id']));
    expect(errors).toStrictEqual([]);
  });

});
