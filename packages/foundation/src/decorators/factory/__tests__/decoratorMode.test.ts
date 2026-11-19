import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { buildSync } from 'esbuild';
import { z } from 'zod/v4';
import { createDecoratorRegistry, createTypeRegistry, DecoratorModeError } from '../../../index.js';

describe('decorator mode', () => {
  const registry = createDecoratorRegistry();
  const scoped = registry.for<{ name: string; run(): void }>();
  const types = createTypeRegistry().use({ key: 'label', field: z.string() });
  class Offering {}

  it.each([
    { name: 'Entity', decorate: registry.class('Entity')(), args: [Offering] },
    { name: 'Tag', decorate: scoped.class('Tag')(), args: [Offering] },
    { name: 'Column', decorate: scoped.property('Column')(), args: [Offering.prototype, 'name'] },
    { name: 'Route', decorate: scoped.method('Route')(), args: [Offering.prototype, Symbol('run'), {}] },
    { name: 'Cached', decorate: scoped.accessor('Cached')(), args: [Offering, 'name', {}] },
    { name: 'Column', decorate: scoped.property('Column')(), args: [Offering.prototype, {}] },
    { name: 'Entity', decorate: registry.class('Entity')(), args: [Offering, null] },
    { name: 'Prop', decorate: types.Prop.string(), args: [Offering] },
    { name: 'PropExtension', decorate: types.extensions.label.field('title'), args: [Offering] },
  ])('reports the decorator name and compiler setting for $name', ({ name, decorate, args }) => {
    const apply = () => Reflect.apply(decorate, undefined, args);
    expect(apply).toThrow(DecoratorModeError);
    expect(apply).toThrow(new RegExp(`"${name}".*Turn off experimentalDecorators`));
  });

  it.each([false, true])('runs an esbuild fixture with experimentalDecorators=%s', (experimentalDecorators) => {
    const { outputFiles } = buildSync({
      entryPoints: [resolve(import.meta.dirname, '../../../../tests/fixtures/decorator-mode.ts')],
      tsconfigRaw: { compilerOptions: { experimentalDecorators } },
      platform: 'node',
      target: 'node22',
      bundle: true,
      write: false,
    });
    const run = spawnSync(process.execPath, ['-'], { input: outputFiles[0].text, encoding: 'utf8' });

    if (experimentalDecorators) {
      expect(run.stderr).toMatch(/^DecoratorModeError: .*"Resource".*Turn off experimentalDecorators/m);
      expect(run.status).toBe(1);
    } else {
      expect(run.stderr).toBe('');
      expect(run.status).toBe(0);
    }
  });
});
