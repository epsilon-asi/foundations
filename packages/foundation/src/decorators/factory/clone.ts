function isObjectLike(value: unknown): value is object {
  return (typeof value === 'object' && value !== null) || typeof value === 'function';
}

export function cloneDeep<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if (!isObjectLike(value)) return value;

  if (typeof value === 'function') return value;

  const existing = seen.get(value);
  if (existing !== undefined) return existing as T;

  if (value instanceof Date) {
    return new Date(value.getTime()) as T;
  }

  if (value instanceof RegExp) {
    return new RegExp(value.source, value.flags) as T;
  }

  if (value instanceof Map) {
    const cloned = new Map<unknown, unknown>();
    seen.set(value, cloned);
    for (const [key, mapValue] of value.entries()) {
      cloned.set(cloneDeep(key, seen), cloneDeep(mapValue, seen));
    }
    return cloned as T;
  }

  if (value instanceof Set) {
    const cloned = new Set<unknown>();
    seen.set(value, cloned);
    for (const setValue of value.values()) {
      cloned.add(cloneDeep(setValue, seen));
    }
    return cloned as T;
  }

  if (Array.isArray(value)) {
    const cloned: unknown[] = [];
    seen.set(value, cloned);
    for (const item of value) cloned.push(cloneDeep(item, seen));
    return cloned as T;
  }

  const cloned = Object.create(Object.getPrototypeOf(value)) as Record<PropertyKey, unknown>;
  seen.set(value, cloned);

  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined) continue;

    if ('value' in descriptor) {
      descriptor.value = cloneDeep(descriptor.value, seen);
    }

    Object.defineProperty(cloned, key, descriptor);
  }

  return cloned as T;
}

export function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (!isObjectLike(value)) return value;
  if (seen.has(value)) return value;

  seen.add(value);

  if (value instanceof Map) {
    for (const [key, mapValue] of value.entries()) {
      deepFreeze(key, seen);
      deepFreeze(mapValue, seen);
    }
  } else if (value instanceof Set) {
    for (const setValue of value.values()) {
      deepFreeze(setValue, seen);
    }
  } else {
    for (const key of Reflect.ownKeys(value)) {
      deepFreeze((value as Record<PropertyKey, unknown>)[key], seen);
    }
  }

  return Object.freeze(value);
}

export function immutableClone<T>(value: T): T {
  return deepFreeze(cloneDeep(value));
}
