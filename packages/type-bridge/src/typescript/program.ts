import ts from 'typescript';

/** The file name the source is parsed as. */
export const INPUT_FILE = '/__type_bridge__/input.ts';

const COMPILER_OPTIONS: ts.CompilerOptions = {
  strict: true,
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  lib: ['lib.esnext.d.ts', 'lib.dom.d.ts'],
  noEmit: true,
  skipLibCheck: true,
  types: [],
  noResolve: true,
};

/** Default-library source files, parsed once per process: they are by far the slowest part of building a program. */
const libCache = new Map<string, ts.SourceFile | undefined>();

export interface InputProgram {
  program: ts.Program;
  checker: ts.TypeChecker;
  sourceFile: ts.SourceFile;
}

/** Builds a type-checked program over `source` alone; imports are left unresolved. */
export function createInputProgram(source: string): InputProgram {
  const host = ts.createCompilerHost(COMPILER_OPTIONS, true);
  const sourceFile = ts.createSourceFile(INPUT_FILE, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreate) => {
    if (fileName === INPUT_FILE) return sourceFile;
    if (!libCache.has(fileName))
      libCache.set(fileName, getSourceFile(fileName, languageVersion, onError, shouldCreate));
    return libCache.get(fileName);
  };
  host.fileExists = (fileName) => fileName === INPUT_FILE || ts.sys.fileExists(fileName);
  host.writeFile = () => undefined;
  const program = ts.createProgram({ rootNames: [INPUT_FILE], options: COMPILER_OPTIONS, host });
  return { program, checker: program.getTypeChecker(), sourceFile };
}

/** True when a declaration lives in the input rather than a default library. */
export function isInputDeclaration(node: ts.Node | undefined): boolean {
  return node?.getSourceFile().fileName === INPUT_FILE;
}

/** True when a declaration lives in a default library (`lib.*.d.ts`). */
export function isLibDeclaration(node: ts.Node | undefined): boolean {
  if (!node) return false;
  const file = node.getSourceFile();
  return file.fileName !== INPUT_FILE && /[\\/]lib\.[\w.]*\.d\.ts$/.test(file.fileName);
}
