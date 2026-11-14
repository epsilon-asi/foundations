/**
 * Orders items so each comes after what it depends on, staying as close to the original order as possible.
 *
 * Kahn's algorithm, always taking the ready item with the lowest original index. On a cycle the lowest remaining
 * item is taken anyway; callers handle the resulting forward reference (Python quotes it). `deps` may name items
 * that do not exist; they are ignored.
 */
export function stableTopologicalSort<T>(
  items: readonly T[],
  key: (item: T) => string,
  deps: (item: T) => Iterable<string>,
): T[] {
  const index = new Map<string, number>();
  items.forEach((item, i) => index.set(key(item), i));

  const pending = new Map<number, Set<number>>();
  const dependents = new Map<number, number[]>();
  items.forEach((item, i) => {
    const set = new Set<number>();
    for (const dep of deps(item)) {
      const j = index.get(dep);
      if (j === undefined || j === i) continue;
      set.add(j);
      const list = dependents.get(j) ?? [];
      list.push(i);
      dependents.set(j, list);
    }
    pending.set(i, set);
  });

  const done = new Set<number>();
  const out: T[] = [];
  while (out.length < items.length) {
    let next = -1;
    for (let i = 0; i < items.length; i++) {
      if (!done.has(i) && pending.get(i)!.size === 0) {
        next = i;
        break;
      }
    }
    if (next === -1) {
      for (let i = 0; i < items.length; i++) {
        if (!done.has(i)) {
          next = i;
          break;
        }
      }
    }
    done.add(next);
    out.push(items[next]!);
    for (const dependent of dependents.get(next) ?? []) pending.get(dependent)!.delete(next);
  }
  return out;
}
