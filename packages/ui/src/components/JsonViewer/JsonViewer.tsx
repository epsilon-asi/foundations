import * as React from 'react';
import { Box, type BoxProps } from '@mui/material';
import { Panel } from '../Panel';
import { TreeView } from '../TreeView';
import { CopyButton, type CopyButtonProps } from '../CopyButton';
import { useControllableValue } from '../../internal/useControllableValue';
import { inspectJson } from './inspectJson';

export interface JsonViewerProps extends Omit<BoxProps, 'children' | 'defaultValue'> {
  value: unknown;
  label?: string;
  /** JSON Pointer paths. The empty string addresses the root. */
  expandedPaths?: readonly string[];
  defaultExpandedPaths?: readonly string[];
  onExpandedChange?: (paths: string[]) => void;
  maxDepth?: number;
  maxEntries?: number;
  maxNodes?: number;
  copyable?: boolean;
  copyButtonProps?: Omit<CopyButtonProps, 'value'>;
  maxHeight?: number;
}
export const JsonViewer = React.forwardRef<HTMLDivElement, JsonViewerProps>(function JsonViewer(
  { value, label = 'JSON data', expandedPaths, defaultExpandedPaths = [''], onExpandedChange, maxDepth = 12, maxEntries = 100,
    maxNodes = 1000, copyable = true, copyButtonProps, maxHeight = 360, sx, ...props }, ref
) {
  const inspection = React.useMemo(() => inspectJson(value, { maxDepth, maxEntries, maxNodes }), [value, maxDepth, maxEntries, maxNodes]);
  const [expanded, setExpanded] = useControllableValue(expandedPaths, defaultExpandedPaths);
  const copied = React.useMemo(() => JSON.stringify(inspection.snapshot, null, 2), [inspection]);
  return <Box ref={ref} {...props} sx={[{ minWidth: 0 }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>
    <Panel title={label} headerAction={copyable ? <CopyButton aria-label="Copy inspected JSON" {...copyButtonProps} value={copied} /> : undefined}
      contentSx={{ p: 1, maxHeight, overflow: 'auto' }}>
      <TreeView aria-label={label} descriptionPlacement="inline" items={[inspection.node]} expandedIds={expanded.map(path => `json:${path}`)}
        onExpandedChange={ids => { const next = ids.filter(id => id.startsWith('json:')).map(id => id.slice(5)); setExpanded(next); onExpandedChange?.(next); }} />
    </Panel>
  </Box>;
});
