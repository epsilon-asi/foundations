import * as React from 'react';
import { Box, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { parsePatch, structuredPatch, diffWordsWithSpace, type StructuredPatch } from 'diff';
import { themeMonospace } from '../../theme/category';
import { CompactTable } from '../../internal/CompactTable';
import { CopyButton } from '../CopyButton';
import { ActionButton } from '../ActionButton';
import { Text } from '../Text';
import { Stack } from '../Stack';
import { StatusBadge } from '../StatusBadge';
import { ErrorState } from '../ErrorState';
import { useHighlighter, codeColors } from '../CodeBlock/highlight';
import { styles, type SurfaceProps } from '../../internal/presentation';
type Source =
  | { patch: string; oldValue?: never; newValue?: never; filename?: never }
  | { patch?: never; oldValue: string; newValue: string; filename?: string };
export type DiffViewProps = SurfaceProps &
  Source & {
    view?: 'unified' | 'split';
    showLineNumbers?: boolean;
    contextLines?: number;
    wordDiff?: boolean;
    language?: string;
    maxLines?: number;
    maxHeight?: number | string;
    fileHeader?: boolean;
  };
interface Line {
  kind: string;
  text: string;
  old?: number;
  next?: number;
}
type Row = { left?: Line; right?: Line; peer?: Line; context?: Line[]; heading?: string };
function rows(file: StructuredPatch, context: number, split: boolean) {
  const result: Row[] = [];
  let plus = 0,
    minus = 0,
    count = 0;
  for (const h of file.hunks) {
    let old = h.oldStart,
      next = h.newStart;
    result.push({ heading: '@@ −' + old + ',' + h.oldLines + ' +' + next + ',' + h.newLines + ' @@' });
    let left: Line[] = [],
      right: Line[] = [],
      same: Line[] = [];
    function changes() {
      if (split) {
        for (let i = 0; i < Math.max(left.length, right.length); i++)
          result.push({ left: left[i], right: right[i] });
      } else {
        left.forEach((line, i) => result.push({ left: line, peer: right[i] }));
        right.forEach((line, i) => result.push({ right: line, peer: left[i] }));
      }
      left = [];
      right = [];
    }
    function unchanged() {
      if (!same.length) return;
      const add = (l: Line) => result.push({ left: l, right: l });
      if (same.length <= 2 * context) same.forEach(add);
      else {
        same.slice(0, context).forEach(add);
        result.push({ context: same.slice(context, same.length - context) });
        same.slice(same.length - context).forEach(add);
      }
      same = [];
    }
    for (const raw of h.lines) {
      const kind = raw[0],
        line: Line = { kind, text: raw.slice(1) };
      if (kind === '\\') {
        changes();
        unchanged();
        result.push({ heading: raw });
        continue;
      }
      count++;
      if (kind === ' ') {
        changes();
        line.old = old++;
        line.next = next++;
        same.push(line);
      } else {
        unchanged();
        if (kind === '-') {
          line.old = old++;
          minus++;
          left.push(line);
        } else if (kind === '+') {
          line.next = next++;
          plus++;
          right.push(line);
        }
      }
    }
    changes();
    unchanged();
  }
  return {
    rows: result,
    count,
    summary: plus + ' addition' + (plus === 1 ? '' : 's') + ', ' + minus + ' deletion' + (minus === 1 ? '' : 's')
  };
}
const Content = React.memo(function Content({
  line,
  other,
  words,
  highlightCode
}: {
  line: Line;
  other?: Line;
  words?: boolean;
  highlightCode: ReturnType<typeof useHighlighter>;
}) {
  if (words && other && line.kind !== ' ') {
    const parts = diffWordsWithSpace(
      line.kind === '-' ? line.text : other.text,
      line.kind === '+' ? line.text : other.text,
      { timeout: 25 }
    );
    if (parts)
      return (
        <>
          {parts.map((p, i) =>
            (line.kind === '-' ? p.added : p.removed) ? null : p.added || p.removed ? (
              <mark key={i}>{p.value}</mark>
            ) : (
              p.value
            )
          )}
        </>
      );
  }
  return <>{highlightCode(line.text)[0]}</>;
});
function FileDiff({
  file,
  context,
  split,
  showLineNumbers = true,
  wordDiff,
  language,
  maxLines = 1000,
  fileHeader = true,
  density,
  maxHeight
}: {
  file: StructuredPatch;
  context: number;
  split: boolean;
} & Pick<
  DiffViewProps,
  'showLineNumbers' | 'wordDiff' | 'language' | 'maxLines' | 'fileHeader' | 'density' | 'maxHeight'
>) {
  const highlightCode = useHighlighter(language);
  const model = React.useMemo(() => rows(file, context, split), [file, context, split]);
  const [full, setFull] = React.useState(false),
    [expanded, setExpanded] = React.useState<Set<number>>(() => new Set());
  const deleted = file.isDelete || file.newFileName === '/dev/null',
    added = file.isCreate || file.oldFileName === '/dev/null';
  const path = (deleted ? file.oldFileName : file.newFileName) ?? file.oldFileName ?? 'Changes';
  const status = deleted ? 'Deleted' : added ? 'Added' : file.isRename ? 'Renamed' : 'Modified';
  const hidden = model.count > maxLines && !full;
  const cell = (line: Line | undefined, side: 'old' | 'next', other?: Line) => (
    <TableCell data-kind={line?.kind}>
      {line && (
        <>
          {showLineNumbers && (
            <span className="line-number">
              {split ? line[side] : [line.old ?? '·', line.next ?? '·'].join(' ')}
            </span>
          )}
          <b aria-hidden>{line.kind} </b>
          <Content line={line} other={other} words={wordDiff} highlightCode={highlightCode} />
        </>
      )}
    </TableCell>
  );
  const render = (row: Row, id: string) =>
    split ? (
      <TableRow key={id}>
        {cell(row.left, 'old', row.peer ?? row.right)}
        {cell(row.right, 'next', row.peer ?? row.left)}
      </TableRow>
    ) : (
      <React.Fragment key={id}>
        {row.left && <TableRow>{cell(row.left, 'old', row.peer ?? row.right)}</TableRow>}
        {row.right && row.right !== row.left && (
          <TableRow>{cell(row.right, 'next', row.peer ?? row.left)}</TableRow>
        )}
      </React.Fragment>
    );
  return (
    <Stack density={density}>
      {fileHeader && (
        <Stack direction="row" align="center" wrap>
          <Text variant="code">{path}</Text>
          <StatusBadge label={status} />
          <CopyButton value={path} aria-label="Copy path" />
        </Stack>
      )}
      <Text variant="caption">{model.summary}</Text>
      {hidden ? (
        <ActionButton onClick={() => setFull(true)}>Show full diff</ActionButton>
      ) : (
        <CompactTable
          regionLabel={'Changes in ' + path}
          maxHeight={maxHeight}
          density={density}
          focusable
          aria-label={path + ', ' + model.summary}
          sx={(t) => ({
            fontFamily: themeMonospace(t),
            fontSize: '0.8125rem',
            ...codeColors(t),
            '& .MuiTableCell-root': {
              font: 'inherit',
              borderBottom: 0,
              py: 0.5,
              textAlign: 'start',
              verticalAlign: 'top',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere'
            },
            '& [data-kind="+"]': { bgcolor: 'action.selected' },
            '& [data-kind="-"]': { bgcolor: 'action.hover' },
            '& .line-number': { color: 'text.secondary', paddingInlineEnd: t.spacing(2), userSelect: 'none' }
          })}
        >
          <TableHead>
            <TableRow>
              {split ? (
                <>
                  <TableCell>Before</TableCell>
                  <TableCell>After</TableCell>
                </>
              ) : (
                <TableCell>Changes</TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {model.rows.map((row, i) =>
              row.heading ? (
                <TableRow key={i}>
                  <TableCell colSpan={split ? 2 : 1}>{row.heading}</TableCell>
                </TableRow>
              ) : row.context ? (
                expanded.has(i) ? (
                  row.context.map((l, j) => render({ left: l, right: l }, i + '-' + j))
                ) : (
                  <TableRow key={i}>
                    <TableCell colSpan={split ? 2 : 1}>
                      <ActionButton onClick={() => setExpanded(new Set([...expanded, i]))}>
                        Show {row.context.length} unchanged lines
                      </ActionButton>
                    </TableCell>
                  </TableRow>
                )
              ) : (
                render(row, String(i))
              )
            )}
          </TableBody>
        </CompactTable>
      )}
    </Stack>
  );
}
export function DiffView({
  patch,
  oldValue,
  newValue,
  filename = 'Changes',
  view = 'unified',
  contextLines = 3,
  sx,
  ref,
  ...props
}: DiffViewProps) {
  const host = React.useRef<HTMLDivElement>(null);
  React.useImperativeHandle(ref, () => host.current!);
  const [wide, setWide] = React.useState(false);
  React.useLayoutEffect(() => {
    if (!host.current || typeof ResizeObserver === 'undefined') return;
    const el = host.current;
    const measure = () => setWide(el.clientWidth >= 640);
    measure();
    const obs = new ResizeObserver(measure);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const files = React.useMemo(() => {
    try {
      if (patch === undefined)
        return [
          structuredPatch(filename, filename, oldValue!, newValue!, undefined, undefined, { context: Infinity })
        ];
      const parsed = parsePatch(patch);
      if (!parsed.length || parsed.some((f) => !f.hunks.length && !f.isGit)) return null;
      return parsed;
    } catch {
      return null;
    }
  }, [patch, oldValue, newValue, filename]);
  const { showLineNumbers, wordDiff, language, maxLines, maxHeight, fileHeader, density, ...surface } = props;
  return (
    <Box {...surface} ref={host} sx={styles({ minWidth: 0 }, sx)}>
      {files ? (
        <Stack density={density}>
          {files.map((file, i) => (
            <FileDiff
              key={(file.newFileName ?? '') + i}
              file={file}
              split={view === 'split' && wide}
              context={Math.max(0, Math.floor(contextLines))}
              {...{ showLineNumbers, wordDiff, language, maxLines, maxHeight, fileHeader, density }}
            />
          ))}
        </Stack>
      ) : (
        <ErrorState title="Unable to read diff">
          <Box component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {patch}
          </Box>
        </ErrorState>
      )}
    </Box>
  );
}
