import type { ModuleSpecifier } from '../ir/types.js';

/** `from ..models.user import X` → `{ level: 2, segments: ['models', 'user'] }`. */
export function parsePythonModule(text: string): ModuleSpecifier {
  const level = /^\.*/.exec(text)![0].length;
  const rest = text.slice(level);
  return { level, segments: rest ? rest.split('.') : [] };
}

export function formatPythonModule(spec: ModuleSpecifier): string {
  return '.'.repeat(spec.level) + spec.segments.join('.');
}

const TS_EXTENSIONS = /\.(d\.ts|d\.mts|d\.cts|ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;

/** `'../models/user.js'` → `{ level: 2, segments: ['models', 'user'] }`. A trailing `/index` is dropped. */
export function parseTsModule(text: string): ModuleSpecifier {
  if (!text.startsWith('.')) return { level: 0, segments: text.split('/').filter(Boolean) };
  const parts = text.replace(TS_EXTENSIONS, '').split('/');
  let level = 1;
  const segments: string[] = [];
  for (const part of parts) {
    if (part === '.' || part === '') continue;
    if (part === '..') {
      if (segments.length) segments.pop();
      else level++;
      continue;
    }
    segments.push(part);
  }
  if (segments[segments.length - 1] === 'index') segments.pop();
  return { level, segments };
}

/** `{ level: 2, segments: ['models'] }` → `'../models.js'` (with the default extension). */
export function formatTsModule(spec: ModuleSpecifier, extension: string): string {
  if (spec.level === 0) return spec.segments.join('/');
  const prefix = spec.level === 1 ? './' : '../'.repeat(spec.level - 1);
  if (spec.segments.length === 0) return `${prefix}index${extension}`;
  return `${prefix}${spec.segments.join('/')}${extension}`;
}
