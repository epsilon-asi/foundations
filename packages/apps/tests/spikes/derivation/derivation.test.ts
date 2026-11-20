import { createJsonLogWriter, createLogger } from '@epsilon-asi/foundation';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { ResourceDefinitionError } from '../../../src/model/ResourceDefinitionError.js';
import { derive, Prop, ref } from './variants.js';

class Contact {
  @Prop.string({ crud: 'editable', min: 1 }) name!: string;
  @Prop.string({ crud: 'createOnly' }) source!: string;
  @Prop.string({ crud: 'updateOnly' }) revision!: string;
  @Prop.string({ crud: 'readable' }) status!: string;
  @Prop.string() providerId!: string;
  @Prop.string({ crud: 'internal' }) staffNote!: string;
  @Prop.string({ crud: 'writeOnly' }) password!: string;
  @Prop.string({ crud: 'secret' }) token!: string;
  @Prop(ref(() => Contact).optional(), { crud: 'editable' }) manager?: Contact;
}

class Offering {
  @Prop.string({ crud: 'editable', min: 1 }) name!: string;
  @Prop(z.array(z.url()).default([]), { crud: 'editable' }) links!: string[];
  @(Prop.enum(['draft', 'live'], { default: 'draft', crud: 'editable' })) status!: 'draft' | 'live';
  @Prop(z.int().positive().catch(1), { crud: 'editable' }) rank!: number;
  @Prop(z.array(ref(() => Contact)).min(1).optional(), { crud: 'editable' }) contacts?: Contact[];
  @Prop.string() vectorStoreId!: string;
  @Prop.string({ crud: 'internal' }) internalMemo!: string;
  @Prop.string({ crud: 'writeOnly' }) credential!: string;
  @Prop.string({ crud: 'secret' }) signingKey!: string;
}

const storedContact = {
  name: 'Ada', source: 'inbound', revision: 'changed', status: 'active',
  providerId: 'private-id', staffNote: 'private-note', password: 'private-password', token: 'private-token',
};
const storedOffering = {
  name: 'Research', links: ['https://example.test'], status: 'live', rank: 4, contacts: [storedContact],
  vectorStoreId: 'private-index', internalMemo: 'private-memo', credential: 'private-credential', signingKey: 'private-key',
};
const readModel = {
  name: 'Research', links: ['https://example.test'], status: 'live', rank: 4,
  contacts: [{ name: 'Ada', source: 'inbound', revision: 'changed', status: 'active' }],
};

it('rejects incompatible PATCH modes while deriving an operation schema', () => {
  class ContactNote {
    @Prop.string({ crud: { access: 'editable', patch: 'append' } }) text!: string;
  }
  expect(() => derive(ContactNote, 'update')).toThrow(ResourceDefinitionError);
});

it('leaves unsent PATCH fields absent while create applies defaults', () => {
  const UpdateOffering = { Request: derive(Offering, 'update').schema };
  const CreateOffering = { Request: derive(Offering, 'create').schema };
  const patch = UpdateOffering.Request.parse({ name: 'Renamed' });

  expect(patch).toStrictEqual({ name: 'Renamed' });
  expect({ ...storedOffering, ...patch }).toStrictEqual({ ...storedOffering, name: 'Renamed' });
  expect(CreateOffering.Request.parse({ name: 'New', credential: 'new-password' })).toStrictEqual({
    name: 'New', credential: 'new-password', links: [], status: 'draft', rank: 1,
  });
  for (const invalid of [{ links: ['invalid-url'] }, { status: 'invalid' }, { rank: 0 }, { contacts: [] }]) {
    expect(UpdateOffering.Request.safeParse(invalid).success).toBe(false);
  }
});

it('uses the matching write variant for each nested resource', () => {
  const create = derive(Offering, 'create').schema;
  const contact = { name: 'Ada', source: 'inbound', password: 'private-password' };
  const input = { name: 'New', credential: 'new-password', contacts: [contact] };
  expect(create.parse(input).contacts).toStrictEqual([contact]);
  expect(create.safeParse({ ...input, contacts: [{ ...contact, revision: 'update-only' }] }).success).toBe(false);

  const update = derive(Offering, 'update').schema;
  const patch = { contacts: [{ revision: 'latest', password: 'new-password' }] };
  expect(update.parse(patch)).toStrictEqual(patch);
  expect(update.safeParse({ contacts: [{ name: '' }] }).success).toBe(false);
  for (const forbidden of [
    { unknown: 'field' }, { signingKey: 'secret' }, { contacts: [{ source: 'create-only' }] },
    { contacts: [{ token: 'nested secret' }] },
  ]) {
    expect(update.safeParse(forbidden).success).toBe(false);
  }
});

it('excludes every server-only access preset from responses, messages and raw structured logs', () => {
  const { schema: read, serverOnlyFields } = derive(Offering, 'read');
  const response = z.object({ data: read });
  const message = z.object({ offering: read });
  expect(response.parse({ data: storedOffering })).toStrictEqual({ data: readModel });
  expect(message.parse({ offering: storedOffering })).toStrictEqual({ offering: readModel });

  const lines: string[] = [];
  const logger = createLogger({
    redaction: { shouldRedact: key => serverOnlyFields.has(key) },
    write: createJsonLogWriter({ write: line => lines.push(line) }),
  });
  logger.info('offering saved', { offering: storedOffering });
  expect(JSON.parse(lines[0])).toStrictEqual({ level: 'info', message: 'offering saved', offering: readModel });
});

it('collects redaction keys even from a recursive resource reached only through a hidden field', () => {
  class Credential {
    @Prop.string({ crud: 'secret' }) passwordHash!: string;
    @Prop(ref(() => Credential).optional(), { crud: 'readable' }) previous?: Credential;
  }
  class Account {
    @Prop.string({ crud: 'readable' }) name!: string;
    @Prop(ref(() => Credential), { crud: 'internal' }) credential!: Credential;
  }

  const { schema, serverOnlyFields } = derive(Account, 'read');
  const credential = { passwordHash: 'current', previous: { passwordHash: 'old' } };
  expect(schema.parse({ name: 'Ada', credential })).toStrictEqual({ name: 'Ada' });
  expect(serverOnlyFields).toEqual(new Set(['credential', 'passwordHash']));

  const lines: string[] = [];
  const logger = createLogger({
    redaction: { shouldRedact: key => serverOnlyFields.has(key) },
    write: createJsonLogWriter({ write: line => lines.push(line) }),
  });
  logger.info('rotated', { history: [credential] });
  expect(JSON.parse(lines[0]).history).toStrictEqual([{ previous: {} }]);
});

it('projects recursive references and rejects an unsupported container before it can expose a full model', () => {
  const contact = derive(Contact, 'read').schema;
  const publicContact = { name: 'Ada', source: 'inbound', revision: 'changed', status: 'active' };
  expect(contact.parse({ ...storedContact, manager: storedContact })).toStrictEqual({
    ...publicContact, manager: publicContact,
  });

  class Unsupported {
    @Prop(z.union([ref(() => Contact), z.string()]), { crud: 'editable' }) contact!: Contact | string;
  }
  expect(() => derive(Unsupported, 'read')).toThrow('Unsupported schema in the derivation spike: union');
});
