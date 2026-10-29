import { createDecoratorRegistry } from '../factory';
import type {
    ClassDecoratorDefinition,
    Constructor,
    DecorationRecord,
    DecoratorRegistry,
    DecoratorSchema,
    PropertyDecoratorDefinition,
} from '../factory';

export type RequestSection = 'params' | 'body' | 'query' | 'headers';
export type AutoMapSection = 'param' | 'body' | 'query' | 'header';
export type DataType = 'string' | 'number' | 'boolean' | 'date';

export type RequestPrimitive = string | number | boolean | Date;

export interface RequestContents<
    Body extends Record<string, unknown> | undefined = Record<string, unknown>,
    Query extends Record<string, unknown> | undefined = Record<string, unknown>,
    Params extends Record<string, unknown> | undefined = Record<string, unknown>,
    Headers extends Record<string, unknown> | undefined = Record<string, unknown>,
> {
    body?: Body;
    query?: Query;
    params?: Params;
    headers?: Headers;
}

export interface RequestObjectMetadata {
    description?: string;
}

export interface RequestFieldBaseMetadata {
    section: RequestSection;
    /**
     * Source key inside request.params/request.body/request.query/request.headers.
     * Defaults to the decorated property name.
     */
    name?: string;
    required?: boolean;
    description?: string;
}

export interface StringRequestFieldMetadata extends RequestFieldBaseMetadata {
    type: 'string';
    default?: string;
}

export interface NumberRequestFieldMetadata extends RequestFieldBaseMetadata {
    type: 'number';
    default?: number;
    integer?: boolean;
    min?: number;
    max?: number;
}

export interface BooleanRequestFieldMetadata extends RequestFieldBaseMetadata {
    type: 'boolean';
    default?: boolean;
}

export interface DateRequestFieldMetadata extends RequestFieldBaseMetadata {
    type: 'date';
    default?: Date;
}

export interface UnknownRequestFieldMetadata extends RequestFieldBaseMetadata {
    type?: undefined;
    default?: unknown;
}

export type RequestFieldMetadata =
    | StringRequestFieldMetadata
    | NumberRequestFieldMetadata
    | BooleanRequestFieldMetadata
    | DateRequestFieldMetadata
    | UnknownRequestFieldMetadata;

export type AutoMapOpts = {
    /** Exactly one of these should be true. */
    param?: boolean;
    body?: boolean;
    query?: boolean;
    header?: boolean;
    name?: string;
    key?: string;
    type?: DataType;
    required?: boolean;
    default?: unknown;
    description?: string;
};

export interface RequestMappingSchema extends DecoratorSchema {
    class: {
        requestObject: ClassDecoratorDefinition<RequestObjectMetadata | undefined>;
    };
    property: {
        requestField: PropertyDecoratorDefinition<RequestFieldMetadata, unknown>;
    };
    method: {};
    accessor: {};
}

export type FieldDecoratorFor<TValue> = <TThis, TActual extends TValue | undefined>(
    value: undefined,
    context: ClassFieldDecoratorContext<TThis, TActual>,
) => void;

export type AnyFieldDecorator = <TThis, TActual>(
    value: undefined,
    context: ClassFieldDecoratorContext<TThis, TActual>,
) => void;

export type StringFieldOptions = Omit<StringRequestFieldMetadata, 'section' | 'type'>;
export type NumberFieldOptions = Omit<NumberRequestFieldMetadata, 'section' | 'type'>;
export type BooleanFieldOptions = Omit<BooleanRequestFieldMetadata, 'section' | 'type'>;
export type DateFieldOptions = Omit<DateRequestFieldMetadata, 'section' | 'type'>;
export type UnknownFieldOptions = Omit<UnknownRequestFieldMetadata, 'section' | 'type'>;

export interface RequestSectionDecorator<TDefaultValue> {
    (): FieldDecoratorFor<TDefaultValue>;
    (name: string): FieldDecoratorFor<TDefaultValue>;
    (options: StringFieldOptions & { type: 'string' }): FieldDecoratorFor<string>;
    (options: NumberFieldOptions & { type: 'number' }): FieldDecoratorFor<number>;
    (options: BooleanFieldOptions & { type: 'boolean' }): FieldDecoratorFor<boolean>;
    (options: DateFieldOptions & { type: 'date' }): FieldDecoratorFor<Date>;
    (options: UnknownFieldOptions): FieldDecoratorFor<TDefaultValue>;
    (name: string, options: StringFieldOptions & { type: 'string' }): FieldDecoratorFor<string>;
    (name: string, options: NumberFieldOptions & { type: 'number' }): FieldDecoratorFor<number>;
    (name: string, options: BooleanFieldOptions & { type: 'boolean' }): FieldDecoratorFor<boolean>;
    (name: string, options: DateFieldOptions & { type: 'date' }): FieldDecoratorFor<Date>;
    (name: string, options: UnknownFieldOptions): FieldDecoratorFor<TDefaultValue>;

    string(name?: string, options?: StringFieldOptions): FieldDecoratorFor<string>;
    number(name?: string, options?: NumberFieldOptions): FieldDecoratorFor<number>;
    boolean(name?: string, options?: BooleanFieldOptions): FieldDecoratorFor<boolean>;
    date(name?: string, options?: DateFieldOptions): FieldDecoratorFor<Date>;
}

export interface RequestMappingDefinition {
    propertyName: string;
    sourceKey: string;
    section: RequestSection;
    type?: DataType;
    required: boolean;
    static: boolean;
    private: boolean;
    metadata: RequestFieldMetadata;
    record: DecorationRecord;
}

export interface LegacyMetaEntry {
    key: string;
    sourceKey: string;
    dataType?: DataType;
    required?: boolean;
}

export interface LegacyMetaContainer {
    params: Record<string, LegacyMetaEntry>;
    body: Record<string, LegacyMetaEntry>;
    query: Record<string, LegacyMetaEntry>;
    headers: Record<string, LegacyMetaEntry>;
}

export interface RequestMapperOptions {
    namespace?: string;
    allowPrivateMembers?: boolean;
}

export interface RequestReadOptions {
    includeInherited?: boolean;
}

export interface AssignRequestOptions extends RequestReadOptions {
    /**
     * If true, throws when @Param/@Body/@Query/@Header is applied to a static field.
     * Defaults to true because request objects are normally instance DTOs.
     */
    rejectStatic?: boolean;
}

export interface ToRequestContentsOptions extends RequestReadOptions {
    includeUndefined?: boolean;
    /**
     * By default values are preserved. Use 'http' to stringify params/query/headers.
     */
    serialize?: 'preserve' | 'http';
    rejectStatic?: boolean;
}

export class RequestMappingError extends Error {
    public readonly section?: RequestSection;
    public readonly propertyName?: string;
    public readonly sourceKey?: string;

    public constructor(
        message: string,
        details: {
            section?: RequestSection;
            propertyName?: string;
            sourceKey?: string;
        } = {},
    ) {
        super(message);
        this.name = 'RequestMappingError';
        this.section = details.section;
        this.propertyName = details.propertyName;
        this.sourceKey = details.sourceKey;
    }
}

type ConcreteConstructor<T> = new (...args: never[]) => T;

type RequestSectionSource = Record<string, unknown> | undefined;

const pendingRequestSymbol: unique symbol = Symbol('requestMapping.pendingRequest');

type PendingRequestCarrier = {
    [pendingRequestSymbol]?: RequestContents;
};

function setPendingRequest(target: object, request: RequestContents): void {
    Object.defineProperty(target, pendingRequestSymbol, {
        configurable: true,
        enumerable: false,
        writable: true,
        value: request,
    });
}

function getPendingRequest(target: object): RequestContents | undefined {
    return (target as PendingRequestCarrier)[pendingRequestSymbol];
}

type RequestMapperApi = {
    registry: DecoratorRegistry<RequestMappingSchema>;
    RequestObject(metadata?: RequestObjectMetadata): <TClass extends Constructor>(
        value: TClass,
        context: ClassDecoratorContext<TClass>,
    ) => void;
    AutoMap(opts: AutoMapOpts & { type: 'string' }): FieldDecoratorFor<string>;
    AutoMap(opts: AutoMapOpts & { type: 'number' }): FieldDecoratorFor<number>;
    AutoMap(opts: AutoMapOpts & { type: 'boolean' }): FieldDecoratorFor<boolean>;
    AutoMap(opts: AutoMapOpts & { type: 'date' }): FieldDecoratorFor<Date>;
    AutoMap(opts: AutoMapOpts): AnyFieldDecorator;
    Param: RequestSectionDecorator<string>;
    Query: RequestSectionDecorator<string>;
    Header: RequestSectionDecorator<string>;
    Body: RequestSectionDecorator<unknown>;
    getRequestMappingDefinitions(target: Constructor | object, options?: RequestReadOptions): readonly RequestMappingDefinition[];
    getAutoMapMeta(target: Constructor | object, options?: RequestReadOptions): LegacyMetaContainer;
    assignRequestContents<T extends object>(target: T, request: RequestContents, options?: AssignRequestOptions): T;
    requestContentsToObject<T extends object>(ctor: ConcreteConstructor<T>, request: RequestContents, options?: AssignRequestOptions): T;
    objectToRequestContents<T extends object>(source: T, options?: ToRequestContentsOptions): RequestContents;
};

export function createRequestMapper(options: RequestMapperOptions = {}): RequestMapperApi {
    const registry = createDecoratorRegistry<RequestMappingSchema>({
        namespace: options.namespace ?? 'request-mapping',
        allowPrivateMembers: options.allowPrivateMembers ?? false,
    });

    const RequestObject = registry.class('requestObject') as RequestMapperApi['RequestObject'];
    const Scoped = registry.for<Record<string, unknown>>();
    const RawRequestField = Scoped.property('requestField');

    function makeFieldDecorator(metadata: RequestFieldMetadata): AnyFieldDecorator {
        const recordDecorator = RawRequestField(metadata) as unknown as AnyFieldDecorator;

        return function requestFieldDecorator<TThis, TActual>(
            value: undefined,
            context: ClassFieldDecoratorContext<TThis, TActual>,
        ): void | ((initialValue: TActual) => TActual) {
            recordDecorator(value, context);

            if (context.static || typeof context.name !== 'string') {
                return undefined;
            }

            const propertyName = context.name;
            const sourceKey = metadata.name ?? propertyName;

            return function requestFieldInitializer(this: TThis, initialValue: TActual): TActual {
                if (typeof this !== 'object' || this === null) return initialValue;

                const request = getPendingRequest(this);
                if (request === undefined) return initialValue;

                const definition = createInitializerDefinition({
                    propertyName,
                    sourceKey,
                    metadata,
                    static: context.static,
                    private: context.private,
                });

                const rawValue = getSectionSource(request, metadata.section)?.[sourceKey];
                return coerceRequestValue(rawValue, definition) as TActual;
            };
        } as AnyFieldDecorator;
    }

    function AutoMap(opts: AutoMapOpts): AnyFieldDecorator {
        const section = sectionFromAutoMapOptions(opts);
        const metadata = normalizeMetadata(section, undefined, opts.name ?? opts.key, opts);
        return makeFieldDecorator(metadata);
    }

    const Param = createSectionDecorator('params', 'string', makeFieldDecorator);
    const Query = createSectionDecorator('query', 'string', makeFieldDecorator);
    const Header = createSectionDecorator('headers', 'string', makeFieldDecorator);
    const Body = createSectionDecorator('body', undefined, makeFieldDecorator);

    function getRequestMappingDefinitions(
        target: Constructor | object,
        readOptions: RequestReadOptions = {},
    ): readonly RequestMappingDefinition[] {
        const snapshot = registry.read(target, {
            includeInherited: readOptions.includeInherited,
        });

        return Object.freeze(
            snapshot.propertyRecords('requestField').map((record) => {
                if (record.memberName === undefined) {
                    throw new RequestMappingError('Request mapping record is missing memberName.');
                }

                if (typeof record.memberName === 'symbol') {
                    throw new RequestMappingError(
                        `Request mapping does not support symbol member keys: ${String(record.memberName)}.`,
                    );
                }

                const metadata = record.metadata as RequestFieldMetadata;
                const propertyName = record.memberName;
                const sourceKey = metadata.name ?? propertyName;

                return Object.freeze({
                    propertyName,
                    sourceKey,
                    section: metadata.section,
                    type: metadata.type,
                    required: metadata.required ?? false,
                    static: record.static,
                    private: record.private,
                    metadata,
                    record,
                });
            }),
        );
    }

    function getAutoMapMeta(
        target: Constructor | object,
        readOptions: RequestReadOptions = {},
    ): LegacyMetaContainer {
        const result: LegacyMetaContainer = {
            params: {},
            body: {},
            query: {},
            headers: {},
        };

        for (const definition of getRequestMappingDefinitions(target, readOptions)) {
            const entry = {
                key: definition.propertyName,
                sourceKey: definition.sourceKey,
                dataType: definition.type,
                required: definition.required,
            } satisfies LegacyMetaEntry;

            result[definition.section][definition.propertyName] = entry;
        }

        return result;
    }

    function assignRequestContents<T extends object>(
        target: T,
        request: RequestContents,
        assignOptions: AssignRequestOptions = {},
    ): T {
        const rejectStatic = assignOptions.rejectStatic ?? true;

        for (const definition of getRequestMappingDefinitions(target, assignOptions)) {
            assertUsableDefinition(definition, rejectStatic);
            const sectionSource = getSectionSource(request, definition.section);
            const rawValue = sectionSource?.[definition.sourceKey];
            const value = coerceRequestValue(rawValue, definition);
            setObjectProperty(target, definition.propertyName, value);
        }

        return target;
    }

    function requestContentsToObject<T extends object>(
        ctor: ConcreteConstructor<T>,
        request: RequestContents,
        assignOptions: AssignRequestOptions = {},
    ): T {
        const instance = new ctor();
        return assignRequestContents(instance, request, assignOptions);
    }

    function objectToRequestContents<T extends object>(
        source: T,
        toOptions: ToRequestContentsOptions = {},
    ): RequestContents {
        const rejectStatic = toOptions.rejectStatic ?? true;
        const includeUndefined = toOptions.includeUndefined ?? true;
        const serialize = toOptions.serialize ?? 'preserve';
        const out: RequestContents = {
            params: {},
            body: {},
            query: {},
            headers: {},
        };

        for (const definition of getRequestMappingDefinitions(source, toOptions)) {
            assertUsableDefinition(definition, rejectStatic);
            const value = getObjectProperty(source, definition.propertyName);
            if (value === undefined && !includeUndefined) continue;
            const section = ensureSection(out, definition.section);
            section[definition.sourceKey] = serializeValueForRequest(value, definition, serialize);
        }

        return out;
    }

    return Object.freeze({
        registry,
        RequestObject,
        AutoMap: AutoMap as RequestMapperApi['AutoMap'],
        Param,
        Query,
        Header,
        Body,
        getRequestMappingDefinitions,
        getAutoMapMeta,
        assignRequestContents,
        requestContentsToObject,
        objectToRequestContents,
    });
}

function createSectionDecorator<TDefaultValue>(
    section: RequestSection,
    defaultType: DataType | undefined,
    makeFieldDecorator: (metadata: RequestFieldMetadata) => AnyFieldDecorator,
): RequestSectionDecorator<TDefaultValue> {
    const decorator = ((first?: string | RequestFieldMetadataLike, second?: RequestFieldMetadataLike) => {
        const metadata = normalizeSectionDecoratorMetadata(section, defaultType, first, second);
        return makeFieldDecorator(metadata);
    }) as RequestSectionDecorator<TDefaultValue>;

    decorator.string = (name?: string, options: StringFieldOptions = {}) =>
        makeFieldDecorator(normalizeMetadata(section, 'string', name, options)) as FieldDecoratorFor<string>;

    decorator.number = (name?: string, options: NumberFieldOptions = {}) =>
        makeFieldDecorator(normalizeMetadata(section, 'number', name, options)) as FieldDecoratorFor<number>;

    decorator.boolean = (name?: string, options: BooleanFieldOptions = {}) =>
        makeFieldDecorator(normalizeMetadata(section, 'boolean', name, options)) as FieldDecoratorFor<boolean>;

    decorator.date = (name?: string, options: DateFieldOptions = {}) =>
        makeFieldDecorator(normalizeMetadata(section, 'date', name, options)) as FieldDecoratorFor<Date>;

    return decorator;
}

type RequestFieldMetadataLike = Partial<Omit<RequestFieldMetadata, 'section'>> & {
    type?: DataType;
    name?: string;
};

function normalizeSectionDecoratorMetadata(
    section: RequestSection,
    defaultType: DataType | undefined,
    first?: string | RequestFieldMetadataLike,
    second?: RequestFieldMetadataLike,
): RequestFieldMetadata {
    if (typeof first === 'string') {
        return normalizeMetadata(section, defaultType, first, second ?? {});
    }

    return normalizeMetadata(section, defaultType, first?.name, first ?? {});
}

function normalizeMetadata(
    section: RequestSection,
    defaultType: DataType | undefined,
    explicitName: string | undefined,
    options: RequestFieldMetadataLike | AutoMapOpts | undefined,
): RequestFieldMetadata {
    const {
        name: _name,
        key: _key,
        param: _param,
        body: _body,
        query: _query,
        header: _header,
        type: optionType,
        ...rest
    } = (options ?? {}) as RequestFieldMetadataLike & AutoMapOpts;

    return {
        ...rest,
        section,
        name: explicitName,
        type: optionType ?? defaultType,
    } as RequestFieldMetadata;
}

function sectionFromAutoMapOptions(opts: AutoMapOpts): RequestSection {
    const sections: RequestSection[] = [];
    if (opts.param) sections.push('params');
    if (opts.body) sections.push('body');
    if (opts.query) sections.push('query');
    if (opts.header) sections.push('headers');

    if (sections.length !== 1) {
        throw new RequestMappingError('@AutoMap requires exactly one of { param, body, query, header }.');
    }

    return sections[0];
}

function createInitializerDefinition(args: {
    propertyName: string;
    sourceKey: string;
    metadata: RequestFieldMetadata;
    static: boolean;
    private: boolean;
}): RequestMappingDefinition {
    return {
        propertyName: args.propertyName,
        sourceKey: args.sourceKey,
        section: args.metadata.section,
        type: args.metadata.type,
        required: args.metadata.required ?? false,
        static: args.static,
        private: args.private,
        metadata: args.metadata,
        record: undefined as unknown as DecorationRecord,
    };
}

function assertUsableDefinition(definition: RequestMappingDefinition, rejectStatic: boolean): void {
    if (definition.private) {
        throw new RequestMappingError(
            `Request mapping field "${definition.propertyName}" cannot be private.`,
            definition,
        );
    }

    if (rejectStatic && definition.static) {
        throw new RequestMappingError(
            `Request mapping field "${definition.propertyName}" must be an instance field, not static.`,
            definition,
        );
    }
}

function getSectionSource(request: RequestContents, section: RequestSection): RequestSectionSource {
    return request[section] as RequestSectionSource;
}

function ensureSection(request: RequestContents, section: RequestSection): Record<string, unknown> {
    const existing = request[section];
    if (existing !== undefined) return existing as Record<string, unknown>;
    const created: Record<string, unknown> = {};
    request[section] = created as never;
    return created;
}

function coerceRequestValue(rawValue: unknown, definition: RequestMappingDefinition): unknown {
    const metadata = definition.metadata;
    const missing = rawValue === undefined || rawValue === null;

    if (missing) {
        if (Object.prototype.hasOwnProperty.call(metadata, 'default')) {
            return cloneSimpleDefault((metadata as { default?: unknown }).default);
        }

        if (definition.required) {
            throw new RequestMappingError(
                `Missing required ${definition.section} value "${definition.sourceKey}" for property "${definition.propertyName}".`,
                definition,
            );
        }

        return undefined;
    }

    switch (metadata.type) {
        case undefined:
            return rawValue;
        case 'string':
            return coerceString(rawValue);
        case 'number':
            return coerceNumber(rawValue, definition);
        case 'boolean':
            return coerceBoolean(rawValue, definition);
        case 'date':
            return coerceDate(rawValue, definition);
        default:
            return assertNever(metadata);
    }
}

function coerceString(value: unknown): string {
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    return String(value);
}

function coerceNumber(value: unknown, definition: RequestMappingDefinition): number {
    if (typeof value === 'number') {
        validateNumber(value, definition);
        return value;
    }

    if (typeof value === 'boolean') {
        const numberValue = value ? 1 : 0;
        validateNumber(numberValue, definition);
        return numberValue;
    }

    if (typeof value !== 'string' || value.trim() === '') {
        throw new RequestMappingError(
            `Expected ${definition.section} value "${definition.sourceKey}" to be a number-compatible value.`,
            definition,
        );
    }

    const numberValue = Number(value);
    validateNumber(numberValue, definition);
    return numberValue;
}

function validateNumber(value: number, definition: RequestMappingDefinition): void {
    const metadata = definition.metadata as NumberRequestFieldMetadata;

    if (!Number.isFinite(value)) {
        throw new RequestMappingError(
            `Expected ${definition.section} value "${definition.sourceKey}" to be a finite number.`,
            definition,
        );
    }

    if (metadata.integer === true && !Number.isInteger(value)) {
        throw new RequestMappingError(
            `Expected ${definition.section} value "${definition.sourceKey}" to be an integer.`,
            definition,
        );
    }

    if (metadata.min !== undefined && value < metadata.min) {
        throw new RequestMappingError(
            `Expected ${definition.section} value "${definition.sourceKey}" to be >= ${metadata.min}.`,
            definition,
        );
    }

    if (metadata.max !== undefined && value > metadata.max) {
        throw new RequestMappingError(
            `Expected ${definition.section} value "${definition.sourceKey}" to be <= ${metadata.max}.`,
            definition,
        );
    }
}

function coerceBoolean(value: unknown, definition: RequestMappingDefinition): boolean {
    if (typeof value === 'boolean') return value;

    if (typeof value === 'number') {
        if (value === 1) return true;
        if (value === 0) return false;
    }

    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
        if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
    }

    throw new RequestMappingError(
        `Expected ${definition.section} value "${definition.sourceKey}" to be boolean-compatible.`,
        definition,
    );
}

function coerceDate(value: unknown, definition: RequestMappingDefinition): Date {
    if (value instanceof Date) {
        assertValidDate(value, definition);
        return value;
    }

    let date: Date;
    if (typeof value === 'number') {
        date = new Date(value);
    } else if (typeof value === 'string') {
        const trimmed = value.trim();
        const numeric = trimmed !== '' ? Number(trimmed) : Number.NaN;
        date = Number.isFinite(numeric) ? new Date(numeric) : new Date(trimmed);
    } else {
        throw new RequestMappingError(
            `Expected ${definition.section} value "${definition.sourceKey}" to be date-compatible.`,
            definition,
        );
    }

    assertValidDate(date, definition);
    return date;
}

function assertValidDate(value: Date, definition: RequestMappingDefinition): void {
    if (Number.isNaN(value.getTime())) {
        throw new RequestMappingError(
            `Expected ${definition.section} value "${definition.sourceKey}" to be a valid date.`,
            definition,
        );
    }
}

function serializeValueForRequest(
    value: unknown,
    definition: RequestMappingDefinition,
    mode: 'preserve' | 'http',
): unknown {
    if (mode === 'preserve') return value;
    if (value === undefined || value === null) return value;

    if (definition.section === 'body') {
        return value;
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    return String(value);
}

function setObjectProperty(target: object, propertyName: string, value: unknown): void {
    (target as Record<string, unknown>)[propertyName] = value;
}

function getObjectProperty(target: object, propertyName: string): unknown {
    return (target as Record<string, unknown>)[propertyName];
}

function cloneSimpleDefault<T>(value: T): T {
    if (value instanceof Date) return new Date(value.getTime()) as T;
    if (Array.isArray(value)) return value.slice() as T;
    if (isPlainObject(value)) return { ...value } as T;
    return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object'
        && value !== null
        && Object.getPrototypeOf(value) === Object.prototype;
}

function assertNever(value: never): never {
    throw new RequestMappingError(`Unsupported request mapping metadata: ${JSON.stringify(value)}.`);
}

const defaultMapper = createRequestMapper();

export const requestMappingRegistry = defaultMapper.registry;
export const RequestObject = defaultMapper.RequestObject;
export const AutoMap = defaultMapper.AutoMap;
export const Param = defaultMapper.Param;
export const Query = defaultMapper.Query;
export const Header = defaultMapper.Header;
export const Body = defaultMapper.Body;
export const getRequestMappingDefinitions = defaultMapper.getRequestMappingDefinitions;
export const getAutoMapMeta = defaultMapper.getAutoMapMeta;
export const assignRequestContents = defaultMapper.assignRequestContents;
export const requestContentsToObject = defaultMapper.requestContentsToObject;
export const objectToRequestContents = defaultMapper.objectToRequestContents;

export class MappedRequest<TRequest extends RequestContents = RequestContents> {
    public defaultConstruct(request: TRequest): void {
        assignRequestContents(this, request);
    }

    public construct(_request: TRequest): void {
        // Extension hook for subclasses.
    }

    public destruct(options?: ToRequestContentsOptions): TRequest {
        return objectToRequestContents(this, options) as TRequest;
    }

    public toRequestContents(options?: ToRequestContentsOptions): TRequest {
        return this.destruct(options);
    }

    public validateWith<TError>(
        validate: (value: this) => readonly TError[] | Promise<readonly TError[]>,
    ): Promise<readonly TError[]> {
        return Promise.resolve(validate(this));
    }

    public constructor(request?: TRequest) {
        if (request !== undefined) {
            setPendingRequest(this, request);
        }
    }

    public static create<T extends object>(this: ConcreteConstructor<T>, data: Partial<CleanRequestObject<T>>): T {
        const instance = new this();
        for (const key of Object.keys(data) as Array<keyof typeof data>) {
            (instance as Record<string, unknown>)[key as string] = data[key];
        }
        return instance;
    }

    public static fromRequest<T extends object>(
        this: ConcreteConstructor<T>,
        request: RequestContents,
        options?: AssignRequestOptions,
    ): T {
        const instance = new this();
        assignRequestContents(instance, request, options);
        const maybeConstruct = (instance as { construct?: (request: RequestContents) => void }).construct;
        if (typeof maybeConstruct === 'function') maybeConstruct.call(instance, request);
        return instance;
    }
}

export type CleanRequestObject<T> = Omit<
    T,
    'defaultConstruct' | 'construct' | 'destruct' | 'toRequestContents' | 'validateWith'
>;

export function CleanRequestObject<T extends object>(request: T): CleanRequestObject<T> {
    const out: Record<string, unknown> = {};

    for (const key of Object.keys(request)) {
        const value = (request as Record<string, unknown>)[key];
        if (typeof value !== 'function') out[key] = value;
    }

    return out as CleanRequestObject<T>;
}

export default MappedRequest;
