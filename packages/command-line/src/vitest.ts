import { transform } from 'esbuild';

/**
 * Vite plugin for projects that test decorated command classes with vitest.
 * Import it from `@epsilon-asi/command-line/vitest`; it needs `esbuild`
 * installed in the project (an optional peer dependency).
 */

export interface StandardDecoratorsOptions {
  /** esbuild target. Defaults to `es2024`. */
  target?: string;
}

/** The shape of the plugin, spelled out so importing it needs no Vite types. */
export interface StandardDecoratorsPlugin {
  readonly name: 'standard-decorators';
  readonly enforce: 'pre';
  transform(code: string, id: string): Promise<{ code: string; map: string } | null>;
}

/**
 * Transforms TypeScript with esbuild instead of Vite's oxc transform, which
 * only implements legacy (experimentalDecorators) decorators. esbuild emits
 * standard decorators together with `Symbol.metadata`, which the decorator
 * registry relies on.
 */
export function standardDecorators(options: StandardDecoratorsOptions = {}): StandardDecoratorsPlugin {
  const target = options.target ?? 'es2024';

  return {
    name: 'standard-decorators',
    enforce: 'pre',
    async transform(code, id) {
      const file = id.split('?')[0] ?? id;
      if (!/\.[cm]?ts$/.test(file) || file.includes('/node_modules/')) return null;

      const result = await transform(code, {
        loader: 'ts',
        format: 'esm',
        target,
        sourcemap: true,
        sourcefile: file,
        tsconfigRaw: { compilerOptions: { verbatimModuleSyntax: true, useDefineForClassFields: true } },
      });

      return { code: result.code, map: result.map };
    },
  };
}
