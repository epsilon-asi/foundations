/** Normalizes a single value or a list into a set; `undefined` means "no constraint" and stays `undefined`. */
export function toSet<T>(value: T | readonly T[] | undefined): ReadonlySet<T> | undefined {
  if (value === undefined) return undefined;
  return new Set(isList(value) ? value : [value]);
}

/** Appends `value` to the list stored under `key`, creating the list on first use. */
export function pushToMap<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const values = map.get(key);
  if (values) values.push(value);
  else map.set(key, [value]);
}

function isList<T>(value: T | readonly T[]): value is readonly T[] {
  return Array.isArray(value);
}
