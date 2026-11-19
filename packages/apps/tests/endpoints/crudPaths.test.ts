import { expect, it } from 'vitest';
import { crudPaths } from '../../src/endpoints/crudPaths.js';

it('derives the collection segment and item parameter from a compound resource name', () => {
  expect(crudPaths({ name: 'ApiKey' })).toEqual({
    collection: '/api-keys',
    item: '/api-keys/:apiKeyId',
  });
});

it('uses the declared plural for the collection and the singular name for the item parameter', () => {
  expect(crudPaths({ name: 'Company', plural: 'Companies' })).toEqual({
    collection: '/companies',
    item: '/companies/:companyId',
  });
});

it('rejects a plural that produces a reserved static segment', () => {
  expect(() => crudPaths({ name: 'Upload', plural: 'Bulk' }))
    .toThrow('Route "/bulk" uses the reserved path segment "bulk".');
});

it.each(['', 'Catalog/Items', ':collection'])('rejects %j as a collection segment', (plural) => {
  expect(() => crudPaths({ name: 'Item', plural })).toThrow('single static path segment');
});

it('requires a singular name even when the plural is supplied', () => {
  expect(() => crudPaths({ name: '', plural: 'Items' })).toThrow('A resource name is required');
});

it('prefixes the child collection and item with the parent item path', () => {
  expect(crudPaths({ name: 'SalesThread', parent: { name: 'SalesCampaign' } })).toEqual({
    collection: '/sales-campaigns/:salesCampaignId/sales-threads',
    item: '/sales-campaigns/:salesCampaignId/sales-threads/:salesThreadId',
  });
});

it('uses each declared plural while deriving both parameters from singular names', () => {
  expect(crudPaths({
    name: 'Person', plural: 'People', parent: { name: 'Company', plural: 'Companies' },
  })).toEqual({
    collection: '/companies/:companyId/people',
    item: '/companies/:companyId/people/:personId',
  });
});

it('checks reserved segments and invalid collection names on the parent', () => {
  expect(() => crudPaths({ name: 'Item', parent: { name: 'Catalog', plural: 'Restore' } }))
    .toThrow('reserved path segment "restore"');
  expect(() => crudPaths({ name: 'Item', parent: { name: 'Catalog', plural: 'One/Two' } }))
    .toThrow('single static path segment');
});

it('rejects parent and child IDs that would map to the same flat request field', () => {
  expect(() => crudPaths({ name: 'Folder', parent: { name: 'Folder' } }))
    .toThrow('both use the path parameter "folderId"');
});
