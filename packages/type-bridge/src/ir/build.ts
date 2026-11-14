import type {
  FunctionType,
  LiteralValue,
  Member,
  PrimitiveName,
  PrimitiveType,
  ReferenceType,
  TypeNode,
  TypeParam,
} from './types.js';

/** Builders for IR nodes. They keep lowering code short and normalize what can be normalized at construction. */
export const t = {
  primitive(name: PrimitiveName): PrimitiveType {
    return { kind: 'primitive', name };
  },
  literal(value: LiteralValue, float = false): TypeNode {
    return float ? { kind: 'literal', value, float } : { kind: 'literal', value };
  },
  reference(name: string, args: TypeNode[] = [], target: ReferenceType['target'] = 'unresolved'): ReferenceType {
    return { kind: 'reference', name, args, target };
  },
  array(element: TypeNode, readonly = false): TypeNode {
    return { kind: 'array', element, readonly };
  },
  union(members: TypeNode[]): TypeNode {
    return unionOf(members);
  },
  any: (): PrimitiveType => ({ kind: 'primitive', name: 'any' }),
  unknown: (): PrimitiveType => ({ kind: 'primitive', name: 'unknown' }),
  never: (): PrimitiveType => ({ kind: 'primitive', name: 'never' }),
  fn(params: FunctionType['params'], returns: TypeNode, extra: Partial<FunctionType> = {}): FunctionType {
    return { kind: 'function', params, returns, typeParams: [], ...extra };
  },
};

/** A canonical string for a type, used to dedupe union members and compare types structurally. */
export function typeKey(node: TypeNode): string {
  switch (node.kind) {
    case 'primitive':
      return node.name;
    case 'literal':
      return `lit:${typeof node.value}:${String(node.value)}`;
    case 'template':
      return `tpl:${node.parts.map((p) => (typeof p === 'string' ? JSON.stringify(p) : typeKey(p))).join(',')}`;
    case 'array':
      return `${node.readonly ? 'ro-' : ''}arr<${typeKey(node.element)}>`;
    case 'tuple':
      return `${node.readonly ? 'ro-' : ''}tup<${node.elements
        .map((e) => `${e.rest ?? ''}${e.optional ? '?' : ''}${typeKey(e.type)}`)
        .join(',')}>`;
    case 'set':
      return `${node.readonly ? 'ro-' : ''}set<${typeKey(node.element)}>`;
    case 'record':
      return `${node.readonly ? 'ro-' : ''}rec<${typeKey(node.key)},${typeKey(node.value)}>`;
    case 'map':
      return `${node.readonly ? 'ro-' : ''}${node.weak ? 'weak' : ''}map<${typeKey(node.key)},${typeKey(node.value)}>`;
    case 'reference':
      return `ref:${node.name}<${node.args.map(typeKey).join(',')}>`;
    case 'well-known':
      return `wk:${node.name}<${node.args.map(typeKey).join(',')}>`;
    case 'union':
      return `union(${node.members.map(typeKey).sort().join('|')})`;
    case 'intersection':
      return `inter(${node.members.map(typeKey).sort().join('&')})`;
    case 'function':
      return `fn(${node.params.map((p) => `${p.kind}:${p.optional ? '?' : ''}${typeKey(p.type)}`).join(',')})=>${typeKey(node.returns)}`;
    case 'object':
      return `obj{${node.members
        .map((m) => (m.kind === 'property' ? `${m.name}${m.optional ? '?' : ''}:${typeKey(m.type)}` : `${m.name}()`))
        .join(';')}}`;
    case 'enum-member':
      return `enum:${node.enumName}.${node.member}`;
    case 'class-of':
      return `classof<${typeKey(node.type)}>`;
    case 'self':
      return 'self';
    case 'opaque':
      return `opaque:${node.text}`;
    case 'raw':
      return `raw:${node.text}`;
  }
}

const NULLISH = new Set<PrimitiveName>(['none', 'null', 'undefined', 'void']);

export function isNullish(node: TypeNode): boolean {
  return node.kind === 'primitive' && NULLISH.has(node.name);
}

export function isPrimitive(node: TypeNode, ...names: PrimitiveName[]): node is PrimitiveType {
  return node.kind === 'primitive' && (names.length === 0 || names.includes(node.name));
}

/**
 * Builds a union: nested unions are flattened, duplicates removed, `never` dropped, and `any` absorbs everything.
 * `true | false` collapses to `boolean`. A single member is returned as itself; no members is `never`.
 */
export function unionOf(input: TypeNode[]): TypeNode {
  const flat: TypeNode[] = [];
  const push = (node: TypeNode): void => {
    if (node.kind === 'union') node.members.forEach(push);
    else flat.push(node);
  };
  input.forEach(push);

  if (flat.some((m) => isPrimitive(m, 'any'))) return t.any();

  const seen = new Set<string>();
  let members: TypeNode[] = [];
  for (const member of flat) {
    if (isPrimitive(member, 'never')) continue;
    const key = typeKey(member);
    if (seen.has(key)) continue;
    seen.add(key);
    members.push(member);
  }

  const hasTrue = members.some((m) => m.kind === 'literal' && m.value === true);
  const hasFalse = members.some((m) => m.kind === 'literal' && m.value === false);
  if (hasTrue && hasFalse) {
    const index = members.findIndex((m) => m.kind === 'literal' && typeof m.value === 'boolean');
    members = members.filter((m) => !(m.kind === 'literal' && typeof m.value === 'boolean'));
    if (!seen.has('boolean')) members.splice(index, 0, t.primitive('boolean'));
  }
  // A boolean literal is redundant next to `boolean`.
  if (members.some((m) => isPrimitive(m, 'boolean'))) {
    members = members.filter((m) => !(m.kind === 'literal' && typeof m.value === 'boolean'));
  }

  if (members.length === 0) return t.never();
  if (members.length === 1) return members[0]!;
  return { kind: 'union', members };
}

/** The members of a union, or the type itself. */
export function unionMembers(node: TypeNode): TypeNode[] {
  return node.kind === 'union' ? node.members : [node];
}

/** Splits nullish members out of a type: `T | null | undefined` → `{ base: T, nullish: [null, undefined] }`. */
export function splitNullish(node: TypeNode): { base: TypeNode; nullish: TypeNode[] } {
  const members = unionMembers(node);
  const nullish = members.filter(isNullish);
  if (nullish.length === 0) return { base: node, nullish };
  return { base: unionOf(members.filter((m) => !isNullish(m))), nullish };
}

/** Calls `visit` for `node` and every type nested in it (members, parameters, bounds, ...), parents first. */
export function walkType(node: TypeNode, visit: (node: TypeNode) => void): void {
  visit(node);
  forEachChild(node, (child) => walkType(child, visit));
}

function forEachChild(node: TypeNode, fn: (child: TypeNode) => void): void {
  switch (node.kind) {
    case 'array':
    case 'set':
      fn(node.element);
      return;
    case 'tuple':
      node.elements.forEach((e) => fn(e.type));
      return;
    case 'record':
    case 'map':
      fn(node.key);
      fn(node.value);
      return;
    case 'reference':
    case 'well-known':
      node.args.forEach(fn);
      return;
    case 'union':
    case 'intersection':
      node.members.forEach(fn);
      return;
    case 'template':
      node.parts.forEach((p) => typeof p !== 'string' && fn(p));
      return;
    case 'function':
      node.params.forEach((p) => fn(p.type));
      fn(node.returns);
      node.typeParams.forEach((tp) => typeParamChildren(tp).forEach(fn));
      return;
    case 'object':
      node.members.forEach((m) => memberTypes(m).forEach(fn));
      node.indexSignatures.forEach((s) => {
        fn(s.key);
        fn(s.value);
      });
      node.callSignatures.forEach(fn);
      return;
    case 'class-of':
      fn(node.type);
      return;
    case 'primitive':
    case 'literal':
    case 'enum-member':
    case 'self':
    case 'opaque':
    case 'raw':
      return;
  }
}

function typeParamChildren(tp: TypeParam): TypeNode[] {
  return [...(tp.bound ? [tp.bound] : []), ...(tp.constraints ?? []), ...(tp.default ? [tp.default] : [])];
}

function memberTypes(member: Member): TypeNode[] {
  return member.kind === 'property' ? [member.type] : member.signatures;
}

/** Names of every declaration-or-unresolved reference in a type (not type parameters). */
export function referencedNames(nodes: TypeNode[]): Set<string> {
  const names = new Set<string>();
  for (const node of nodes) {
    walkType(node, (n) => {
      if (n.kind === 'reference' && n.target !== 'type-param') names.add(n.name);
      if (n.kind === 'enum-member') names.add(n.enumName);
    });
  }
  return names;
}
