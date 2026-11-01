import { describe, expect, it } from 'vitest';
import { standardDecorators } from '../src/vitest.js';

const DECORATED = `
  function Tag(_value: unknown, context: ClassDecoratorContext): void { void context; }
  @Tag
  export class Thing { value!: string; }
`;

describe('standardDecorators', () => {
  it('is a pre-enforced plugin', () => {
    const plugin = standardDecorators();
    expect(plugin.name).toBe('standard-decorators');
    expect(plugin.enforce).toBe('pre');
  });

  it('compiles standard decorators in TypeScript files with esbuild helpers that set Symbol.metadata', async () => {
    const result = await standardDecorators().transform(DECORATED, '/project/src/thing.ts');

    expect(result).not.toBeNull();
    expect(result?.code).toContain('__decorateElement');
    expect(result?.code).toMatch(/__knownSymbol\("metadata"\)|Symbol\.metadata/);
    expect(result?.code).not.toContain('@Tag');
    expect(result?.map).toContain('"mappings"');
  });

  it('ignores query strings on ids and honours a custom target', async () => {
    const result = await standardDecorators({ target: 'es2022' }).transform(DECORATED, '/project/src/thing.ts?v=1');

    expect(result?.code).toContain('Thing');
  });

  it('leaves other files and node_modules alone', async () => {
    const plugin = standardDecorators();

    await expect(plugin.transform('export const x = 1;', '/project/src/thing.js')).resolves.toBeNull();
    await expect(plugin.transform(DECORATED, '/project/node_modules/dep/index.ts')).resolves.toBeNull();
  });
});
