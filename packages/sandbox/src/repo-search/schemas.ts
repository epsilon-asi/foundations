/** Zod schemas (and inferred types) for path mentions, exported so callers can validate or embed them. */
import { z } from 'zod';

export const PathMentionKindSchema = z
  .enum(['relative-path', 'absolute-path', 'file-url', 'basename'])
  .describe(
    'Classifies the form of the original path mention, such as a relative path, absolute path, file URL, or bare basename.',
  );

export type PathMentionKind = z.infer<typeof PathMentionKindSchema>;

export const PathMentionConfidenceSchema = z
  .enum(['exact', 'case-insensitive', 'suffix', 'basename', 'ambiguous-basename'])
  .describe('Describes how confidently the candidate mention was matched to a repository path.');

export type PathMentionConfidence = z.infer<typeof PathMentionConfidenceSchema>;

export const PathMentionTextRangeSchema = z
  .object({
    offset: z.number().int().nonnegative().describe('Zero-based UTF-16 offset in the searched text.'),
    endOffset: z.number().int().nonnegative().describe('Zero-based UTF-16 exclusive end offset in the searched text.'),
    line: z.number().int().positive().describe('1-based line number in the searched text.'),
    column: z.number().int().positive().describe('1-based column number in the searched text.'),
    endLine: z.number().int().positive().describe('1-based end line number in the searched text.'),
    endColumn: z.number().int().positive().describe('1-based exclusive end column in the searched text.'),
    sourceIndex: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .describe('Index of the searched text block when the input is an array.'),
  })
  .describe('Location of a path mention within the searched text.')
  .superRefine((range, ctx) => {
    if (range.endOffset < range.offset) {
      ctx.addIssue({
        code: 'custom',
        path: ['endOffset'],
        message: 'endOffset must be greater than or equal to offset.',
      });
    }
    if (range.endLine < range.line) {
      ctx.addIssue({ code: 'custom', path: ['endLine'], message: 'endLine must be greater than or equal to line.' });
    }
    if (range.endLine === range.line && range.endColumn < range.column) {
      ctx.addIssue({
        code: 'custom',
        path: ['endColumn'],
        message: 'endColumn must be greater than or equal to column when endLine equals line.',
      });
    }
  });

export type PathMentionTextRange = z.infer<typeof PathMentionTextRangeSchema>;

export const PathMentionSchema = z
  .object({
    mention: z
      .string()
      .describe('Original text that looked like a repository path or filename, including line suffixes when present.'),
    candidate: z
      .string()
      .describe(
        'Candidate path after punctuation trimming and file URL decoding, before matching to repository files.',
      ),
    normalizedCandidate: z
      .string()
      .describe('Repository-style normalized candidate path, always using forward slashes.'),
    path: z.string().describe('Matching repository-relative path, always using forward slashes.'),
    absolutePath: z.string().describe('Absolute filesystem path for the matched repository file.'),
    basename: z.string().describe('Filename portion of the matched path, excluding parent directories.'),
    extension: z
      .string()
      .describe('File extension for the matched path. May be an empty string when the file has no extension.'),
    language: z.string().describe('Detected or inferred programming language associated with the matched file.'),
    kind: PathMentionKindSchema.describe(
      'Classifies whether the mention was relative, absolute, a file URL, or a bare basename.',
    ),
    confidence: PathMentionConfidenceSchema.describe(
      'Match confidence category describing how the mention resolved to the repository path.',
    ),
    score: z.number().describe('Numeric matching score used to rank or compare candidate repository path matches.'),
    textRange: PathMentionTextRangeSchema.describe(
      'Text range identifying where the path mention appears in the searched text.',
    ),
    referencedLine: z
      .number()
      .int()
      .positive()
      .nullable()
      .describe('Referenced source line from suffixes such as src/a.ts:12 or src/a.ts#L12.'),
    referencedColumn: z
      .number()
      .int()
      .positive()
      .nullable()
      .describe('Referenced source column from suffixes such as src/a.ts:12:4.'),
    ambiguous: z.boolean().describe('True when a bare filename maps to multiple repository files.'),
    alternatives: z
      .array(z.string().describe('Alternative repository-relative path sharing the same bare filename.'))
      .nullable()
      .describe('Other repository paths sharing the same bare filename, when ambiguity exists.'),
  })
  .describe('A detected path-like mention in searched text and its resolved repository path metadata.');

export type PathMention = z.infer<typeof PathMentionSchema>;
