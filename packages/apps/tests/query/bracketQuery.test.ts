import { expect, it } from 'vitest';
import { decodeBracketQuery, encodeBracketQuery } from '../../src/query/bracketQuery.js';

it('round-trips scalar query leaves and preserves sort priority', () => {
  const query = {
    where: { name: { $eq: 'A&+[]= β' }, note: { $eq: null }, label: { $eq: '' } },
    orderBy: { name: 'asc', createdAt: 'desc' }, page: '1',
  };
  const decoded = decodeBracketQuery(encodeBracketQuery(query));
  expect(decoded).toEqual(query);
  expect(Object.keys(decoded.orderBy!)).toEqual(['name', 'createdAt']);
  expect(Object.getPrototypeOf(decoded)).toBeNull();
  expect(Object.getPrototypeOf(decoded.where)).toBeNull();
});

it('rejects ambiguous, malformed and reserved query paths', () => {
  for (const search of ['where[type]=a&where[type][$eq]=b', 'orderBy[name]=asc&orderBy=desc',
    'orderBy[name]=asc&orderBy[name]=desc', 'where[]=x', 'where[name=x', 'where[a][b][c]=x', 'where[constructor]=x']) {
    expect(() => decodeBracketQuery(search)).toThrow(/query field/i);
  }
});
