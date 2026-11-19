import type { TreeItemDefinition } from '../TreeView';

interface Inspection { node: TreeItemDefinition; snapshot: unknown }
export interface InspectionLimits { maxDepth: number; maxEntries: number; maxNodes: number }
const pointer = (path: string, key: string) => `${path}/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`;
const limit = (value: number, fallback: number, maximum: number, minimum = 1) => Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, Math.floor(value))) : fallback;

/** Uses descriptors so inspecting or copying never reads a getter or calls toJSON. */
export function inspectJson(value: unknown, requested: InspectionLimits): Inspection {
  const maxDepth = limit(requested.maxDepth, 12, 100, 0); const maxEntries = limit(requested.maxEntries, 100, 1000);
  const maxNodes = limit(requested.maxNodes, 1000, 10000); let count = 0;
  const visit = (input: unknown, path: string, name: string, depth: number, ancestors: Map<object, string>): Inspection => {
    const leaf = (display: string, snapshot: unknown, description: string): Inspection => ({ node: { id: `json:${path}`, label: `${name}: ${display}`, description }, snapshot });
    if (++count > maxNodes) return leaf('[Node limit reached]', '[Node limit reached]', 'truncated');
    if (input === null) return leaf('null', null, 'null');
    switch (typeof input) {
      case 'string': return leaf(JSON.stringify(input), input, 'string');
      case 'boolean': return leaf(String(input), input, 'boolean');
      case 'number': return leaf(String(input), Number.isFinite(input) ? input : `[${String(input)}]`, 'number');
      case 'undefined': return leaf('undefined', '[undefined]', 'undefined');
      case 'bigint': return leaf(`${input}n`, `[BigInt: ${input}]`, 'bigint');
      case 'symbol': return leaf(String(input), `[${String(input)}]`, 'symbol');
      case 'function': return leaf('[Function]', '[Function]', 'function');
    }
    if (ancestors.has(input)) {
      const marker = `[Circular → ${ancestors.get(input) || 'root'}]`; return leaf(marker, marker, 'circular reference');
    }
    try {
      if (input instanceof Date) {
        const date = Date.prototype.getTime.call(input); const display = Number.isFinite(date) ? Date.prototype.toISOString.call(input) : 'Invalid Date';
        return leaf(display, display, 'date');
      }
      const array = Array.isArray(input); const prototype = Object.getPrototypeOf(input);
      if (!array && prototype !== Object.prototype && prototype !== null) return leaf('[Unsupported object]', '[Unsupported object]', 'unsupported');
      const keys = array ? null : Object.keys(input);
      const size = array ? Object.getOwnPropertyDescriptor(input, 'length')!.value as number : keys!.length;
      if (depth >= maxDepth && size) return leaf(array ? `Array (${size}) [Depth limit reached]` : `Object (${size}) [Depth limit reached]`, '[Depth limit reached]', 'truncated');
      const nextAncestors = new Map(ancestors); nextAncestors.set(input, path);
      const children: TreeItemDefinition[] = []; const snapshot: unknown[] | Record<string, unknown> = array ? [] : Object.create(null);
      const amount = Math.min(size, maxEntries);
      for (let index = 0; index < amount && count < maxNodes; index++) {
        const key = array ? String(index) : keys![index]; const descriptor = Object.getOwnPropertyDescriptor(input, key); const childPath = pointer(path, key);
        const child = descriptor && !Object.hasOwn(descriptor, 'value')
          ? { node: { id: `json:${childPath}`, label: `${key}: [Getter]`, description: 'accessor — not evaluated' }, snapshot: '[Getter]' }
          : visit(descriptor ? descriptor.value : undefined, childPath, key, depth + 1, nextAncestors);
        if (descriptor && !Object.hasOwn(descriptor, 'value')) count++;
        children.push(child.node);
        if (array) (snapshot as unknown[]).push(child.snapshot); else (snapshot as Record<string, unknown>)[key] = child.snapshot;
      }
      if (children.length < size) {
        const marker = `[${size - children.length} more ${array ? 'items' : 'properties'} — inspection limit reached]`;
        children.push({ id: `more:${path}`, label: marker, description: 'truncated' });
        if (array) (snapshot as unknown[]).push(marker);
        else { let key = '[…]'; while (Object.hasOwn(snapshot, key)) key += '…'; (snapshot as Record<string, unknown>)[key] = marker; }
      }
      return { node: { id: `json:${path}`, label: `${name}: ${array ? 'Array' : 'Object'} (${size})`, children: children.length ? children : undefined }, snapshot };
    } catch {
      return leaf('[Unreadable value]', '[Unreadable value]', 'inspection failed');
    }
  };
  return visit(value, '', 'root', 0, new Map());
}
