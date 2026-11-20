import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { apiVersionHeaders } from '../../src/client/apiVersionHeaders.js';

it('uses the contract version when the client supplies none', () => {
  expect(apiVersionHeaders({ apiVersion: '2026-11-16' })).toStrictEqual({ 'X-Api-Version': '2026-11-16' });
});

it('uses the explicit client version with or without a contract default', () => {
  const version = '2024-02-29';
  expect(apiVersionHeaders({ apiVersion: '2026-11-16', version })).toStrictEqual({ 'X-Api-Version': version });
  expect(new Headers(apiVersionHeaders({ version })).get('X-Api-Version')).toBe(version);
});

it('omits the header when both versions are absent', () => {
  expect(apiVersionHeaders()).toStrictEqual({});
  expect(new Headers(apiVersionHeaders({})).has('X-Api-Version')).toBe(false);
});

it('rejects invalid dates from either source and an empty client override', () => {
  expect(() => apiVersionHeaders({ apiVersion: '2026-02-30' })).toThrow(z.ZodError);
  expect(() => apiVersionHeaders({ apiVersion: '2026-11-16', version: '2026-02-30' })).toThrow(z.ZodError);
  expect(() => apiVersionHeaders({ apiVersion: '2026-11-16', version: '' })).toThrow(z.ZodError);
});

it('returns separate header records for independent requests', () => {
  const options = { apiVersion: '2026-11-16' };
  const first = apiVersionHeaders(options);
  const second = apiVersionHeaders(options);
  first['X-Api-Version'] = '2024-02-29';
  expect(second['X-Api-Version']).toBe(options.apiVersion);
  expect(apiVersionHeaders()).toStrictEqual({});
});
