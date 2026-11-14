import ts from 'typescript';

const OPTIONS: ts.CompilerOptions = {
  strict: true,
  exactOptionalPropertyTypes: true,
  noUncheckedIndexedAccess: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  lib: ['lib.es2023.d.ts', 'lib.dom.d.ts'],
  noEmit: true,
  skipLibCheck: true,
  types: [],
};

const libCache = new Map<string, ts.SourceFile | undefined>();

/**
 * Type-checks generated TypeScript in memory, as `tsc --strict --exactOptionalPropertyTypes` would.
 * `files` provides sibling modules (`'address.ts'`) for relative imports. Returns formatted errors.
 */
export function typecheckTypeScript(code: string, files: Record<string, string> = {}): string[] {
  const root = '/check/';
  const sources = new Map<string, string>([
    [`${root}main.ts`, code],
    ...Object.entries(files).map(([k, v]) => [`${root}${k}`, v] as const),
  ]);
  const host = ts.createCompilerHost(OPTIONS, true);
  const base = host.getSourceFile.bind(host);
  host.getSourceFile = (fileName, version, onError, shouldCreate) => {
    const text = sources.get(fileName);
    if (text !== undefined) return ts.createSourceFile(fileName, text, version, true);
    if (!libCache.has(fileName)) libCache.set(fileName, base(fileName, version, onError, shouldCreate));
    return libCache.get(fileName);
  };
  host.fileExists = (f) => sources.has(f) || ts.sys.fileExists(f);
  host.readFile = (f) => sources.get(f) ?? ts.sys.readFile(f);
  host.writeFile = () => undefined;
  const program = ts.createProgram({ rootNames: [...sources.keys()], options: OPTIONS, host });
  return ts.getPreEmitDiagnostics(program).map((d) => {
    const where = d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start) : undefined;
    const line = where ? `${d.file!.fileName.replace(root, '')}:${where.line + 1}: ` : '';
    return `${line}${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`;
  });
}
