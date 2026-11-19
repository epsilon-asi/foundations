import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithUi } from '../../test/renderWithUi';
import { JsonViewer } from './JsonViewer';
import { inspectJson } from './inspectJson';

it('shows primitives and nested types, escapes text, and supports keyboard disclosure', () => {
  renderWithUi(<JsonViewer value={{ name: '<img src=x onerror=alert(1)>', enabled: false, count: 0, empty: null, list: [1, 2] }} />);
  expect(screen.getByText('name: "<img src=x onerror=alert(1)>"')).toBeVisible(); expect(document.querySelector('img')).toBeNull();
  expect(screen.getByText('enabled: false')).toBeVisible(); expect(screen.getByText('count: 0')).toBeVisible(); expect(screen.getByText('empty: null')).toBeVisible();
  const list = screen.getByRole('treeitem', { name: 'list: Array (2)' }); fireEvent.keyDown(list, { key: 'ArrowRight' }); expect(screen.getByText('0: 1')).toBeVisible();
});
it('reports controlled expansion using escaped JSON Pointer paths', () => {
  const expanded = vi.fn(); const { rerender } = renderWithUi(<JsonViewer value={{ 'a/b~': { child: 1 } }} expandedPaths={['']} onExpandedChange={expanded} />);
  fireEvent.keyDown(screen.getByRole('treeitem', { name: 'a/b~: Object (1)' }), { key: 'ArrowRight' }); expect(expanded).toHaveBeenCalledWith(['', '/a~1b~0']);
  expect(screen.queryByText('child: 1')).not.toBeInTheDocument(); rerender(<JsonViewer value={{ 'a/b~': { child: 1 } }} expandedPaths={['', '/a~1b~0']} />);
  expect(screen.getByText('child: 1')).toBeVisible();
});
it('handles cycles and shared references without invoking getters or toJSON while copying', async () => {
  const getter = vi.fn(() => { throw new Error('must not execute'); }); const toJSON = vi.fn(); const data: Record<string, unknown> = { shared: { n: 1 }, toJSON };
  data.again = data.shared; data.self = data; Object.defineProperty(data, 'secret', { enumerable: true, get: getter });
  const copy = vi.fn().mockResolvedValue(undefined); renderWithUi(<JsonViewer value={data} copyButtonProps={{ copy }} />);
  expect(screen.getByText('self: [Circular → root]')).toBeVisible(); expect(screen.getByText('secret: [Getter]')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Copy inspected JSON' })); await waitFor(() => expect(copy).toHaveBeenCalledTimes(1));
  const snapshot = JSON.parse(copy.mock.calls[0][0]); expect(snapshot.shared).toEqual({ n: 1 }); expect(snapshot.again).toEqual({ n: 1 });
  expect(snapshot.secret).toBe('[Getter]'); expect(getter).not.toHaveBeenCalled(); expect(toJSON).not.toHaveBeenCalled();
});
it('bounds depth, entries and nodes and marks truncation in both display and copied snapshot', () => {
  const inspected = inspectJson({ a: { child: true }, b: 2, c: 3 }, { maxDepth: 1, maxEntries: 2, maxNodes: 10 });
  expect(inspected.node.children?.[0].label).toContain('Depth limit reached'); expect(inspected.node.children?.at(-1)?.label).toContain('1 more properties');
  expect(JSON.stringify(inspected.snapshot)).toContain('inspection limit reached');
  const bounded = inspectJson(Array.from({ length: 1000 }, (_, i) => i), { maxDepth: 10, maxEntries: 1000, maxNodes: 4 });
  expect(bounded.node.children).toHaveLength(4); expect(bounded.node.children?.at(-1)?.description).toBe('truncated');
});
it('handles non-JSON values, unreadable proxies and prototype-like keys safely', () => {
  const data = JSON.parse('{"__proto__":{"safe":true},"constructor":0}');
  const inspected = inspectJson(data, { maxDepth: 12, maxEntries: 100, maxNodes: 1000 }); expect(JSON.parse(JSON.stringify(inspected.snapshot))).toEqual(data);
  const proxy = new Proxy({}, { getPrototypeOf() { throw new Error('blocked'); } });
  expect(inspectJson(proxy, { maxDepth: 12, maxEntries: 100, maxNodes: 1000 }).snapshot).toBe('[Unreadable value]');
  renderWithUi(<JsonViewer value={[undefined, 1n, NaN, new Date('2026-01-01T00:00:00Z')]} />);
  expect(screen.getByText('0: undefined')).toBeVisible(); expect(screen.getByText('1: 1n')).toBeVisible(); expect(screen.getByText('2: NaN')).toBeVisible();
});
