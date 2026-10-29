import type { DecorationKind, DecorationRecord, RegistryMetadataSnapshot } from './types';

function cloneRecords(records: readonly DecorationRecord[]): readonly DecorationRecord[] {
  return Object.freeze(records.slice());
}

function filterRecords(
  records: readonly DecorationRecord[],
  kind: DecorationKind,
  decorator?: string,
): readonly DecorationRecord[] {
  return Object.freeze(
    records.filter((record) => {
      if (record.kind !== kind) return false;
      return decorator === undefined || record.decorator === decorator;
    }),
  );
}

function memberMap(
  records: readonly DecorationRecord[],
  kind: 'property' | 'method' | 'accessor',
  decorator?: string,
): ReadonlyMap<string | symbol, readonly DecorationRecord[]> {
  const mutable = new Map<string | symbol, DecorationRecord[]>();

  for (const record of records) {
    if (record.kind !== kind) continue;
    if (decorator !== undefined && record.decorator !== decorator) continue;
    if (record.memberName === undefined) continue;

    const existing = mutable.get(record.memberName);
    if (existing === undefined) {
      mutable.set(record.memberName, [record]);
    } else {
      existing.push(record);
    }
  }

  const frozen = new Map<string | symbol, readonly DecorationRecord[]>();
  for (const [key, value] of mutable.entries()) {
    frozen.set(key, Object.freeze(value.slice()));
  }

  return frozen;
}

export function createSnapshot(records: readonly DecorationRecord[]): RegistryMetadataSnapshot {
  const sorted = records.slice().sort((left, right) => left.order - right.order);
  const all = cloneRecords(sorted);
  const classes = filterRecords(all, 'class');
  const properties = filterRecords(all, 'property');
  const methods = filterRecords(all, 'method');
  const accessors = filterRecords(all, 'accessor');

  return Object.freeze({
    all,
    classes,
    properties,
    methods,
    accessors,

    firstClass(decorator: string) {
      return classes.find((record) => record.decorator === decorator);
    },

    classRecords(decorator?: string) {
      return filterRecords(all, 'class', decorator);
    },

    propertyRecords(decorator?: string) {
      return filterRecords(all, 'property', decorator);
    },

    methodRecords(decorator?: string) {
      return filterRecords(all, 'method', decorator);
    },

    accessorRecords(decorator?: string) {
      return filterRecords(all, 'accessor', decorator);
    },

    propertyMap(decorator?: string) {
      return memberMap(all, 'property', decorator);
    },

    methodMap(decorator?: string) {
      return memberMap(all, 'method', decorator);
    },

    accessorMap(decorator?: string) {
      return memberMap(all, 'accessor', decorator);
    },
  });
}
