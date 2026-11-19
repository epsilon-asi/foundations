import { createRequire, isBuiltin } from 'node:module';
import { fileURLToPath } from 'node:url';

const serverPackages = /^(?:express|redis|stripe|@redis|@mikro-orm|@google-cloud|@aws-sdk)(?:\/|$)/;

export async function checkBrowserBundle(entry) {
  // Each package installs the bundler it uses for its check.
  const { build } = createRequire(entry)('esbuild');
  const { metafile } = await build({
    entryPoints: [fileURLToPath(entry)],
    bundle: true,
    platform: 'browser',
    format: 'esm',
    metafile: true,
    write: false,
  });

  for (const [file, { imports }] of Object.entries(metafile.inputs)) {
    for (const { path, original = path, external } of imports) {
      // Check both the import as written and the package esbuild resolved.
      const resolvedPackage = path.split(/(?:^|\/)node_modules\//).at(-1);
      if (external || original.startsWith('node:') || isBuiltin(original) ||
          serverPackages.test(original) || serverPackages.test(resolvedPackage)) {
        throw new Error(`Forbidden browser import "${original}" in ${file} (resolved to ${path})`);
      }
    }
  }
}
