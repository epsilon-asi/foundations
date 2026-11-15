import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PythonVersion } from '../../src/index.js';

export interface Interpreter {
  version: PythonVersion;
  bin: string;
  /** Third-party modules importable by this interpreter. */
  modules: Set<string>;
}

const PROBE = `
import importlib.util, json, sys
print(json.dumps([m for m in ("typing_extensions", "pydantic") if importlib.util.find_spec(m)]))
`;

const VERSIONS = ['3.11', '3.12', '3.13', '3.14'] as const;
const REQUIRED_MODULES = ['typing_extensions', 'pydantic'];

/** Python interpreters on PATH (`python3.11` ... `python3.14`); tests that need one skip when it is missing. */
export const INTERPRETERS: Interpreter[] = VERSIONS.flatMap((version) => {
  const bin = `python${version}`;
  const probe = spawnSync(bin, ['-I', '-c', PROBE], { encoding: 'utf8' });
  if (probe.status !== 0) return [];
  return [{ version, bin, modules: new Set(JSON.parse(probe.stdout) as string[]) }];
});

// CI sets TYPE_BRIDGE_REQUIRE_PYTHON so a broken interpreter setup fails the run instead of skipping the tests.
if (process.env.TYPE_BRIDGE_REQUIRE_PYTHON) {
  const missing = VERSIONS.flatMap((version) => {
    const found = INTERPRETERS.find((i) => i.version === version);
    if (!found) return [`python${version}`];
    return REQUIRED_MODULES.filter((m) => !found.modules.has(m)).map((m) => `${m} for python${version}`);
  });
  if (missing.length) throw new Error(`TYPE_BRIDGE_REQUIRE_PYTHON is set but these are missing: ${missing.join(', ')}`);
}

export function interpreter(version: PythonVersion, ...needs: string[]): Interpreter | undefined {
  return INTERPRETERS.find((i) => i.version === version && needs.every((m) => i.modules.has(m)));
}

/** Executes `code` as a module (plus `epilogue`, e.g. assertions). Returns stderr on failure. */
export function runPython(bin: string, code: string, epilogue = ''): { ok: boolean; output: string } {
  const result = spawnSync(bin, ['-I', '-'], { input: `${code}\n${epilogue}\n`, encoding: 'utf8' });
  return { ok: result.status === 0, output: `${result.stdout}${result.stderr}` };
}

/** Syntax-checks `code` with an interpreter's own compiler, without importing anything. */
export function compilePython(bin: string, code: string): { ok: boolean; output: string } {
  const script = 'import sys\ncompile(sys.stdin.read(), "generated.py", "exec")';
  const result = spawnSync(bin, ['-I', '-c', script], { input: code, encoding: 'utf8' });
  return { ok: result.status === 0, output: result.stderr };
}

const PYRIGHT = join(dirname(fileURLToPath(import.meta.url)), '../../node_modules/.bin/pyright');

interface PyrightReport {
  generalDiagnostics: {
    file: string;
    severity: string;
    message: string;
    range: { start: { line: number } };
    rule?: string;
  }[];
}

/**
 * Runs pyright (strict) over generated modules for a Python version. Keys are file names (`models.py`); returns
 * `file:line: message` errors. Unresolved third-party imports (pydantic) are ignored.
 */
export function pyright(files: Record<string, string>, version: PythonVersion): string[] {
  const dir = mkdtempSync(join(tmpdir(), 'type-bridge-pyright-'));
  try {
    for (const [name, code] of Object.entries(files)) writeFileSync(join(dir, name), code);
    writeFileSync(join(dir, '__init__.py'), '');
    writeFileSync(
      join(dir, 'pyrightconfig.json'),
      JSON.stringify({
        pythonVersion: version,
        typeCheckingMode: 'strict',
        reportMissingModuleSource: false,
        reportMissingImports: false,
        reportUnusedImport: false,
      }),
    );
    const result = spawnSync(PYRIGHT, ['--outputjson', '-p', dir], { encoding: 'utf8', cwd: dir });
    const report = JSON.parse(result.stdout) as PyrightReport;
    return report.generalDiagnostics
      .filter((d) => d.severity === 'error')
      .filter((d) => !/is unknown|partially unknown/.test(d.message) || !d.message.includes('pydantic'))
      .map(
        (d) =>
          `${d.file.replace(`${dir}/`, '').replace(/^.*\//, '')}:${d.range.start.line + 1}: ${d.message}${d.rule ? ` (${d.rule})` : ''}`,
      );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
