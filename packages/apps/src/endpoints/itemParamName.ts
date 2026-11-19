import { camelResourceName } from './resourceNames.js';

/** Derives the item route parameter from the declared resource name. */
export function itemParamName<Name extends string>(name: Name): `${Uncapitalize<Name>}Id` {
  return `${camelResourceName(name, 'an item parameter')}Id`;
}
