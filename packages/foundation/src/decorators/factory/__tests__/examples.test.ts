import { buildAccessPolicy } from '../examples/authorization.js';
import { buildCrudSummary } from '../examples/crud.js';
import { buildUserTableSchema } from '../examples/orm.js';
import { buildRouteTable } from '../examples/routing.js';
import { serializeUser } from '../examples/serialization.js';
import { buildValidationSchema } from '../examples/validation.js';

describe('example implementations', () => {
  it('builds a validation schema from property metadata', () => {
    expect(buildValidationSchema()).toEqual({
      name: 'signup',
      fields: [
        { name: 'email', type: 'email', required: true },
        { name: 'displayName', type: 'string', required: true, minLength: 2 },
        { name: 'age', type: 'number', required: false, min: 13 },
      ],
    });
  });

  it('builds an access policy from method metadata', () => {
    expect(buildAccessPolicy()).toEqual({
      resource: 'account',
      permissions: [
        { handlerName: 'viewAccount', roles: ['support', 'admin'] },
        { handlerName: 'suspendAccount', roles: ['admin'] },
      ],
    });
  });

  it('keeps existing examples executable', () => {
    expect(buildUserTableSchema().table).toBe('users');
    expect(buildRouteTable().map((route) => route.path)).toEqual(['/api/users/:id', '/api/users']);
    expect(serializeUser()).toEqual({ id: 'user-1', email: 'ray@example.com' });
    expect(buildCrudSummary().resource).toBe('users');
  });
});
