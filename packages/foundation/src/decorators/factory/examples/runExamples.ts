import { readAccessorMetadata } from './accessors';
import { buildAccessPolicy } from './authorization';
import { buildCrudSummary } from './crud';
import { buildUserTableSchema } from './orm';
import { buildRouteTable } from './routing';
import { serializeUser } from './serialization';
import { buildValidationSchema } from './validation';

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
