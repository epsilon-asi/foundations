import { expect, it } from 'vitest';
import { FILTER_OPERATORS, FilterOperator } from '../../src/query/filterOperators.js';

it('names each wire operator in the field groups exactly once', () => {
  const operators = new Set(Object.values(FILTER_OPERATORS).flat());
  expect(Object.values(FilterOperator).sort()).toEqual([...operators].sort());
  for (const [name, operator] of Object.entries(FilterOperator)) {
    expect(operator).toBe(`$${name.toLowerCase()}`);
  }
  expect(Object.isFrozen(FilterOperator)).toBe(true);
});

it('exposes the operator groups used to declare list filters', () => {
  expect(FILTER_OPERATORS).toEqual({
    text: ['$eq', '$ne', '$in', '$nin', '$like', '$ilike'],
    enum: ['$eq', '$ne', '$in', '$nin'],
    range: ['$eq', '$ne', '$in', '$nin', '$gt', '$gte', '$lt', '$lte'],
    boolean: ['$eq', '$ne'],
    id: ['$eq', '$ne', '$in', '$nin'],
    array: ['$contains', '$overlap'],
    nullable: ['$exists', '$eq'],
  });
});

it('keeps the shared table and its operator lists immutable', () => {
  expect(Object.isFrozen(FILTER_OPERATORS)).toBe(true);
  for (const operators of Object.values(FILTER_OPERATORS)) {
    expect(Object.isFrozen(operators)).toBe(true);
  }
});
