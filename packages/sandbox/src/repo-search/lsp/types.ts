export interface LspClientOptions {
  /** Language server executable, for example `typescript-language-server`. */
  command: string;
  args?: readonly string[];
  /** Working directory of the server; also the default workspace root. */
  cwd: string;
  /** Workspace root URI. Default: the `file://` URL of `cwd`. */
  rootUri?: string;
  initializationOptions?: Record<string, unknown>;
  /** Per-request timeout, also the grace period for the server to exit on shutdown. Default: 20 000 ms. */
  timeoutMs?: number;
}

export interface LspPosition {
  /** Zero-based line. */
  line: number;
  /** Zero-based UTF-16 character offset. */
  character: number;
}

export interface LspRange {
  start: LspPosition;
  end: LspPosition;
}

export interface LspLocation {
  uri: string;
  range: LspRange;
}

export interface LspDocumentSymbol {
  name: string;
  detail?: string;
  kind: number;
  range: LspRange;
  selectionRange: LspRange;
  children?: LspDocumentSymbol[];
}
