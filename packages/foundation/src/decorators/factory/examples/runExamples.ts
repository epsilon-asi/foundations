import { readAccessorMetadata } from './accessors.js';
import { buildAccessPolicy } from './authorization.js';
import { buildCrudSummary } from './crud.js';
import { buildUserTableSchema } from './orm.js';
import { buildRouteTable } from './routing.js';
import { serializeUser } from './serialization.js';
import { buildValidationSchema } from './validation.js';

function stable(value: unknown): string {
  return JSON.stringify(value, (_key, innerValue) => {
    if (typeof innerValue === 'symbol') return innerValue.toString();
    return innerValue;
  });
}

const outputs = {
  orm: buildUserTableSchema(),
  routing: buildRouteTable(),
  serialization: serializeUser(),
  crud: buildCrudSummary(),
  accessors: readAccessorMetadata(),
  validation: buildValidationSchema(),
  authorization: buildAccessPolicy(),
};

console.log(stable(outputs));
