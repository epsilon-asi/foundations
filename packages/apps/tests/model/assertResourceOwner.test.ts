import { createTypeRegistry } from '@epsilon-asi/foundation';
import { expect, it } from 'vitest';
import { assertResourceOwner } from '../../src/model/assertResourceOwner.js';
import { httpExtension } from '../../src/model/extensions/http.js';
import { ResourceDefinitionError } from '../../src/model/ResourceDefinitionError.js';

const { Prop, resolve } = createTypeRegistry().use(httpExtension);

it('requires an explicit owner even when an account model has a field named userId', () => {
  class Profile {
    @Prop.uuid() userId!: string;
  }

  const account = { ...resolve(Profile), tenancy: 'account' } as const;
  expect(() => assertResourceOwner(account)).toThrow(ResourceDefinitionError);
  expect(() => assertResourceOwner(account)).toThrow(/Profile.*requires an owner field/);
  expect(() => assertResourceOwner({ ...account, owner: 'userId' })).not.toThrow();
});

it('accepts an inherited owner by its declared name independently of its schema or access', () => {
  class OwnedRecord {
    @Prop.number({ http: { name: 'person_number' } }) personNumber!: number;
  }
  class Profile extends OwnedRecord {}

  const account = { ...resolve(Profile), tenancy: 'account' } as const;
  expect(() => assertResourceOwner({ ...account, owner: 'personNumber' })).not.toThrow();
  expect(() => assertResourceOwner({ ...account, owner: 'person_number' })).toThrow(ResourceDefinitionError);
  expect(() => assertResourceOwner({ ...account, owner: 'person_number' })).toThrow(/Profile.*no declared owner field "person_number"/);
});

it.each(['', '  '])('rejects an empty account owner name %j at declaration time', owner => {
  expect(() => assertResourceOwner({ name: 'Profile', tenancy: 'account', owner })).toThrow(/Profile.*nonempty owner field name/);
});

it('allows tenant-owned resources with optional user ownership', () => {
  class Channel {
    @Prop.uuid() memberId!: string;
  }

  const owned = { ...resolve(Channel), tenancy: 'owned' } as const;
  expect(() => assertResourceOwner(owned)).not.toThrow();
  expect(() => assertResourceOwner({ ...owned, owner: 'memberId' })).not.toThrow();
  expect(() => assertResourceOwner({ ...owned, owner: 'userId' })).toThrow(/Channel.*no declared owner field "userId"/);
});
