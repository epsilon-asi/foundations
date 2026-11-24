import * as React from 'react';
import type { MarkdownProps } from './components/Markdown';
import type { DiffViewProps } from './components/DiffView';
import { Text } from './components/Text';
export type { MarkdownProps, DiffViewProps };
const LazyMarkdown = React.lazy(() => import('./components/Markdown').then((m) => ({ default: m.Markdown })));
const LazyDiffView = React.lazy(() => import('./components/DiffView').then((m) => ({ default: m.DiffView })));
/** Subpath imports are synchronous. The convenience root exports load their parser on first use. */
export function Markdown(props: MarkdownProps) {
  return (
    <React.Suspense
      fallback={
        <Text as="div" sx={{ whiteSpace: 'pre-wrap' }}>
          {props.content}
        </Text>
      }
    >
      <LazyMarkdown {...props} />
    </React.Suspense>
  );
}
export function DiffView(props: DiffViewProps) {
  return (
    <React.Suspense
      fallback={
        <Text as="div" role="status">
          Loading changes…
        </Text>
      }
    >
      <LazyDiffView {...props} />
    </React.Suspense>
  );
}
