import assert from 'node:assert/strict';
import { createJsonLogWriter, createLogger, createTypeRegistry, defineTypeExtension, fields as modelFields, type Logger } from '@epsilon-asi/foundation';
import { Env, EnvVar, loadEnv } from '@epsilon-asi/foundation/env';
import { parseStringSync, serialize } from '@epsilon-asi/foundation/files';
import { z } from 'zod';

const lines: string[] = [];
const logger: Logger = createLogger({
  write: createJsonLogWriter({ format: 'gcp', write: line => lines.push(line) }),
  redaction: { keys: ['token'], shouldRedact: key => key === 'internalId' },
});
const requestLogger = logger.child({ requestId: 'req_1', token: 'bound secret' });
const error = Object.assign(new TypeError('invalid offering'), { internalId: 'private id' });
requestLogger.warn('offering unavailable', { offeringId: 'of_1', error });
assert.equal(lines.length, 1);
const entry = JSON.parse(lines[0]);
assert.deepEqual(entry, {
  severity: 'WARNING', message: 'offering unavailable', requestId: 'req_1', offeringId: 'of_1',
  error: { name: 'TypeError', message: 'invalid offering', stack: error.stack },
});

@Env({ prefix: 'APP_' })
class AppEnv {
  @EnvVar.number('PORT')
  static port: number;
}

loadEnv(AppEnv, { source: { APP_PORT: '4312' }, dotenv: false });
assert.equal(AppEnv.port, 4312);

const checkedFields: string[] = [];
const calendar = defineTypeExtension({
  key: 'calendar',
  field: z.literal('instant'),
  validateField({ typeName, fieldName, schema, options }) {
    const kind: 'instant' = options;
    assert.ok(schema.parse('2025-01-02T03:04:05.000Z') instanceof Date);
    checkedFields.push(`${typeName}.${fieldName}.${kind}`);
  },
});
const { Prop, fields, resolve } = createTypeRegistry().use(calendar);
const statuses = ['draft', 'active'] as const;
const isoDate = z.codec(z.iso.datetime(), z.date(), {
  decode: value => new Date(value),
  encode: value => value.toISOString(),
});

class Offering {
  @Prop.enum(statuses, { default: 'draft' })
  status!: (typeof statuses)[number];

  @Prop(isoDate, { calendar: 'instant' })
  createdAt!: Date;
}

const schema = resolve(Offering).schema;
assert.deepEqual(checkedFields, ['Offering.createdAt.instant']);
const createdAt = '2025-01-02T03:04:05.000Z';
const offering = parseStringSync(schema, JSON.stringify({ createdAt }), { format: 'json' });
assert.deepEqual(offering, { status: 'draft', createdAt: new Date(createdAt) });
assert.deepEqual(JSON.parse(serialize(schema, offering, { format: 'json' })), { status: 'draft', createdAt });

const dateOnly = fields(Offering, { pick: ['createdAt'] });
assert.deepEqual(dateOnly.parse({ createdAt }), { createdAt: new Date(createdAt) });
assert.deepEqual(z.encode(dateOnly, { createdAt: new Date(createdAt) }), { createdAt });
const statusOnly = modelFields(resolve(Offering), { omit: ['createdAt'] });
assert.deepEqual(statusOnly.parse({}), { status: 'draft' });
assert.equal(statusOnly.safeParse({ createdAt }).success, false);

// @ts-expect-error Only a declared enum member can be the default.
Prop.enum(statuses, { default: 'archived' });
