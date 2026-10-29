import { cloneDeep, deepFreeze, immutableClone } from '../clone';
import { createSnapshot } from '../snapshot';
import type { DecorationRecord } from '../types';

describe('clone and freeze helpers', () => {
  it('returns primitive values and functions without cloning them', () => {
    const fn = () => 'ok';

    expect(cloneDeep(undefined)).toBeUndefined();
    expect(cloneDeep(null)).toBeNull();
    expect(cloneDeep(123)).toBe(123);
    expect(cloneDeep('value')).toBe('value');
    expect(cloneDeep(fn)).toBe(fn);
  });

  it('deep-clones dates, regexes, arrays, maps, sets, symbols, descriptors, prototypes, and circular references', () => {
    const symbolKey = Symbol('secret');
    const prototype = { inherited: true };
    const source = Object.create(prototype) as {
      date: Date;
      regex: RegExp;
      list: Array<{ value: string }>;
      map: Map<{ key: string }, { value: string }>;
      set: Set<{ value: string }>;
      self?: unknown;
      computed: string;
      [symbolKey]: { nested: string };
    };

    const mapKey = { key: 'map-key' };
    const mapValue = { value: 'map-value' };
    const setValue = { value: 'set-value' };

    source.date = new Date('2024-01-01T00:00:00.000Z');
    source.regex = /users/gi;
    source.list = [{ value: 'list-value' }];
    source.map = new Map([[mapKey, mapValue]]);
    source.set = new Set([setValue]);
    source[symbolKey] = { nested: 'symbol-value' };
    source.self = source;
    Object.defineProperty(source, 'computed', {
      enumerable: true,
      get() {
        return 'computed-value';
      },
    });

    const cloned = cloneDeep(source);

    expect(Object.getPrototypeOf(cloned)).toBe(prototype);
    expect(cloned).not.toBe(source);
    expect(cloned.date).not.toBe(source.date);
    expect(cloned.date.getTime()).toBe(source.date.getTime());
    expect(cloned.regex).not.toBe(source.regex);
    expect(cloned.regex.source).toBe('users');
    expect(cloned.regex.flags).toContain('g');
    expect(cloned.regex.flags).toContain('i');
    expect(cloned.list).not.toBe(source.list);
    expect(cloned.list[0]).not.toBe(source.list[0]);
    expect(cloned.list[0].value).toBe('list-value');
    expect(cloned.self).toBe(cloned);
    expect(cloned.computed).toBe('computed-value');
    expect(cloned[symbolKey]).not.toBe(source[symbolKey]);
    expect(cloned[symbolKey].nested).toBe('symbol-value');

    const [[clonedMapKey, clonedMapValue]] = Array.from(cloned.map.entries());
    expect(cloned.map).not.toBe(source.map);
    expect(clonedMapKey).not.toBe(mapKey);
    expect(clonedMapKey.key).toBe('map-key');
    expect(clonedMapValue).not.toBe(mapValue);
    expect(clonedMapValue.value).toBe('map-value');

    const [clonedSetValue] = Array.from(cloned.set.values());
    expect(cloned.set).not.toBe(source.set);
    expect(clonedSetValue).not.toBe(setValue);
    expect(clonedSetValue.value).toBe('set-value');
  });

  it('deep-freezes objects, maps, sets, and cycles without infinite recursion', () => {
    const objectValue: { nested: { value: string }; self?: unknown } = {
      nested: { value: 'nested' },
    };
    objectValue.self = objectValue;
    const mapValue = { value: 'map' };
    const mapKey = { key: 'map-key' };
    const setValue = { value: 'set' };
    const container = {
      objectValue,
      map: new Map([[mapKey, mapValue]]),
      set: new Set([setValue]),
    };

    const frozen = deepFreeze(container);

    expect(frozen).toBe(container);
    expect(Object.isFrozen(container)).toBe(true);
    expect(Object.isFrozen(objectValue)).toBe(true);
    expect(Object.isFrozen(objectValue.nested)).toBe(true);
    expect(Object.isFrozen(container.map)).toBe(true);
    expect(Object.isFrozen(mapKey)).toBe(true);
    expect(Object.isFrozen(mapValue)).toBe(true);
    expect(Object.isFrozen(container.set)).toBe(true);
    expect(Object.isFrozen(setValue)).toBe(true);
    expect(deepFreeze('already-primitive')).toBe('already-primitive');
  });

  it('creates immutable clones that cannot be mutated through the original reference', () => {
    const source = { nested: { value: 'before' }, list: [{ value: 'item' }] };
    const cloned = immutableClone(source);

    source.nested.value = 'after';
    source.list[0].value = 'after';

    expect(cloned.nested.value).toBe('before');
    expect(cloned.list[0].value).toBe('item');
    expect(Object.isFrozen(cloned)).toBe(true);
    expect(Object.isFrozen(cloned.nested)).toBe(true);
    expect(Object.isFrozen(cloned.list)).toBe(true);
    expect(Object.isFrozen(cloned.list[0])).toBe(true);
  });
});

describe('metadata snapshot helpers', () => {
  const propertyWithoutName = Object.freeze({
    id: 'snapshot:property:missing:0',
    kind: 'property',
    decorator: 'missingName',
    metadata: undefined,
    static: false,
    private: false,
    order: 0,
  }) as DecorationRecord;

  const records = Object.freeze([
    Object.freeze({
      id: 'snapshot:method:route:2',
      kind: 'method',
      decorator: 'route',
      metadata: { path: '/later' },
      memberName: 'later',
      static: false,
      private: false,
      order: 2,
    }) as DecorationRecord,
    Object.freeze({
      id: 'snapshot:class:entity:1',
      kind: 'class',
      decorator: 'entity',
      metadata: { table: 'users' },
      static: false,
      private: false,
      order: 1,
    }) as DecorationRecord,
    propertyWithoutName,
    Object.freeze({
      id: 'snapshot:property:column:3',
      kind: 'property',
      decorator: 'column',
      metadata: { type: 'varchar' },
      memberName: 'email',
      static: false,
      private: false,
      order: 3,
    }) as DecorationRecord,
    Object.freeze({
      id: 'snapshot:accessor:cached:4',
      kind: 'accessor',
      decorator: 'cached',
      metadata: { ttlMs: 10 },
      memberName: 'displayName',
      static: false,
      private: false,
      order: 4,
    }) as DecorationRecord,
  ]);

  it('sorts records, exposes filtered arrays, and returns frozen copies', () => {
    const snapshot = createSnapshot(records);

    expect(snapshot.all.map((record) => record.order)).toEqual([0, 1, 2, 3, 4]);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.all)).toBe(true);
    expect(Object.isFrozen(snapshot.classes)).toBe(true);
    expect(Object.isFrozen(snapshot.properties)).toBe(true);
    expect(Object.isFrozen(snapshot.methods)).toBe(true);
    expect(Object.isFrozen(snapshot.accessors)).toBe(true);

    expect(snapshot.firstClass('entity')?.metadata).toEqual({ table: 'users' });
    expect(snapshot.firstClass('controller')).toBeUndefined();
    expect(snapshot.classRecords()).toHaveLength(1);
    expect(snapshot.classRecords('entity')).toHaveLength(1);
    expect(snapshot.classRecords('controller')).toHaveLength(0);
    expect(snapshot.propertyRecords()).toHaveLength(2);
    expect(snapshot.propertyRecords('column')).toHaveLength(1);
    expect(snapshot.methodRecords()).toHaveLength(1);
    expect(snapshot.methodRecords('route')).toHaveLength(1);
    expect(snapshot.methodRecords('missing')).toHaveLength(0);
    expect(snapshot.accessorRecords()).toHaveLength(1);
    expect(snapshot.accessorRecords('cached')).toHaveLength(1);
  });

  it('builds readonly member maps with optional decorator filtering', () => {
    const snapshot = createSnapshot(records);

    const propertyMap = snapshot.propertyMap();
    const columnMap = snapshot.propertyMap('column');
    const methodMap = snapshot.methodMap();
    const routeMap = snapshot.methodMap('route');
    const missingMethodMap = snapshot.methodMap('missing');
    const accessorMap = snapshot.accessorMap();
    const cachedMap = snapshot.accessorMap('cached');

    expect(propertyMap.has('email')).toBe(true);
    expect(propertyMap.has('missingName')).toBe(false);
    expect(columnMap.get('email')).toHaveLength(1);
    expect(methodMap.get('later')).toHaveLength(1);
    expect(routeMap.get('later')).toHaveLength(1);
    expect(missingMethodMap.size).toBe(0);
    expect(accessorMap.get('displayName')).toHaveLength(1);
    expect(cachedMap.get('displayName')).toHaveLength(1);
    expect(Object.isFrozen(columnMap.get('email'))).toBe(true);
  });
});
