import type { Diagnostic, DiagnosticCode, DiagnosticSeverity, SourceLanguage, SourceLocation } from './ir/types.js';

export interface DiagnosticContext {
  loc?: SourceLocation | undefined;
  path?: string | undefined;
}

/** Collects diagnostics during a parse or emit. Each stage owns one and hands its list to the result. */
export class DiagnosticBag {
  readonly items: Diagnostic[] = [];

  add(severity: DiagnosticSeverity, code: DiagnosticCode, message: string, context: DiagnosticContext = {}): void {
    const diagnostic: Diagnostic = { severity, code, message };
    if (context.loc) diagnostic.loc = context.loc;
    if (context.path) diagnostic.path = context.path;
    this.items.push(diagnostic);
  }

  warn(code: DiagnosticCode, message: string, context?: DiagnosticContext): void {
    this.add('warning', code, message, context);
  }

  info(code: DiagnosticCode, message: string, context?: DiagnosticContext): void {
    this.add('info', code, message, context);
  }
}

/** Formats one diagnostic as `warning[unsupported-type] User.tags (3:5): message`. */
export function formatDiagnostic(diagnostic: Diagnostic): string {
  const where = [diagnostic.path, diagnostic.loc && `(${diagnostic.loc.line}:${diagnostic.loc.column})`]
    .filter(Boolean)
    .join(' ');
  return `${diagnostic.severity}[${diagnostic.code}]${where ? ` ${where}` : ''}: ${diagnostic.message}`;
}

/** Thrown when the source is not valid Python or TypeScript. */
export class ParseError extends Error {
  override readonly name = 'ParseError';
  readonly language: SourceLanguage;
  readonly loc: SourceLocation;
  /** The offending line with a caret under the column. */
  readonly frame: string;

  constructor(options: { language: SourceLanguage; message: string; loc: SourceLocation; source: string }) {
    const frame = codeFrame(options.source, options.loc);
    super(`${options.message} (${options.language} ${options.loc.line}:${options.loc.column})\n${frame}`);
    this.language = options.language;
    this.loc = options.loc;
    this.frame = frame;
  }
}

/** Thrown by a conversion with `strict: true` when any diagnostic at or above `warning` was recorded. */
export class ConversionError extends Error {
  override readonly name = 'ConversionError';
  readonly diagnostics: Diagnostic[];

  constructor(diagnostics: Diagnostic[]) {
    super(
      `Conversion produced ${diagnostics.length} diagnostic(s):\n${diagnostics.map((d) => `  ${formatDiagnostic(d)}`).join('\n')}`,
    );
    this.diagnostics = diagnostics;
  }
}

function codeFrame(source: string, loc: SourceLocation): string {
  const line = source.split(/\r?\n/)[loc.line - 1] ?? '';
  const gutter = `${loc.line} | `;
  return `${gutter}${line}\n${' '.repeat(gutter.length + Math.max(0, loc.column - 1))}^`;
}
