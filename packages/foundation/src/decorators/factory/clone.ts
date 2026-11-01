function isObjectLike(value: unknown): value is object {
  return (typeof value === 'object' && value !== null) || typeof value === 'function';
}

export function cloneDeep<T>(
  value: T,
  seen = new WeakMap<object, unknown>(),
  created?: object[],
): T {
  if (!isObjectLike(value)) return value;

  if (typeof value === 'function') return value;

  const existing = seen.get(value);
  if (existing !== undefined) return existing as T;

  if (value instanceof Date) {
    const cloned = new Date(value.getTime());
    created?.push(cloned);
    return cloned as T;
  }

  if (value instanceof RegExp) {
    const cloned = new RegExp(value.source, value.flags);
    created?.push(cloned);
    return cloned as T;
  }

  if (value instanceof Map) {
    const cloned = new Map<unknown, unknown>();
    seen.set(value, cloned);
    created?.push(cloned);
    for (const [key, mapValue] of value.entries()) {
      cloned.set(cloneDeep(key, seen, created), cloneDeep(mapValue, seen, created));
    }
    return cloned as T;
  }

  if (value instanceof Set) {
    const cloned = new Set<unknown>();
    seen.set(value, cloned);
    created?.push(cloned);
    for (const setValue of value.values()) {
      cloned.add(cloneDeep(setValue, seen, created));
    }
    return cloned as T;
  }

  if (Array.isArray(value)) {
    const cloned: unknown[] = [];
    seen.set(value, cloned);
    created?.push(cloned);
    for (const item of value) cloned.push(cloneDeep(item, seen, created));
    return cloned as T;
  }

  const cloned = Object.create(Object.getPrototypeOf(value)) as Record<PropertyKey, unknown>;
  seen.set(value, cloned);
  created?.push(cloned);

  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined) continue;

    if ('value' in descriptor) {
      descriptor.value = cloneDeep(descriptor.value, seen, created);
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
  // Freeze only the objects cloneDeep made. Values it shares by reference (functions, and anything
  // reachable from them) still belong to the caller. A shallow freeze of each is enough: every
  // object cloneDeep made is in `created`, and no getter is invoked along the way.
  const created: object[] = [];
  const cloned = cloneDeep(value, new WeakMap<object, unknown>(), created);
  for (const node of created) Object.freeze(node);
  return cloned;
}
