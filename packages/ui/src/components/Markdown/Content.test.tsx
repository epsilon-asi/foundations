import { fireEvent, screen, within } from '@testing-library/react';
import { renderWithUi } from '../../test/renderWithUi';
import { Markdown } from './Markdown';
import { CodeBlock, InlineCode } from '../CodeBlock';
import { OutputLog } from '../OutputLog';
import { DiffView } from '../DiffView';
it('renders text, tables, tasks and links through a protocol allowlist', () => {
  const click = vi.fn();
  const { container } = renderWithUi(
    <Markdown
      onLinkClick={(href, e) => {
        e.preventDefault();
        click(href);
      }}
      content={
        '# Title\n\n<div>literal</div> ![photo](https://example.org/p) [open](https://example.org) [local](file:///notes)\n\n- [x] **done**\n\n| a | b |\n|---|---|\n| 1 | ~~x~~ |'
      }
    />
  );
  expect(screen.getByRole('heading', { name: 'Title' })).toBeVisible();
  expect(container.textContent).toContain('<div>literal</div>');
  expect(container.querySelector('img')).toBeNull();
  expect(screen.getByRole('checkbox')).toBeChecked();
  expect(screen.getByRole('region', { name: 'Markdown table' })).toContainElement(screen.getByRole('table'));
  expect(screen.getAllByRole('link')).toHaveLength(1);
  fireEvent.click(screen.getByRole('link'));
  expect(click).toHaveBeenCalledWith('https://example.org/');
});
it('retains completed streaming blocks and resolves late reference definitions', () => {
  const renderLink = vi.fn((p: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...p} />);
  const first = '[a](https://example.org)\n\n';
  const { rerender } = renderWithUi(<Markdown content={first + 'tail'} renderLink={renderLink} streaming />);
  const link = screen.getByRole('link');
  renderLink.mockClear();
  rerender(<Markdown content={first + 'tail extended'} renderLink={renderLink} streaming />);
  expect(screen.getByRole('link')).toBe(link);
  expect(renderLink).not.toHaveBeenCalled();
  rerender(<Markdown content={'[reference][r]\n\n[r]: https://example.org\n\n~~~text\nunfinished'} streaming />);
  expect(screen.getByRole('link', { name: 'reference' })).toBeVisible();
  expect(screen.getByText('unfinished')).toBeVisible();
});
it('toggles code wrapping and collapse and renders supplied tokens as text', () => {
  const wrap = vi.fn();
  const { container } = renderWithUi(
    <>
      <InlineCode>inline</InlineCode>
      <CodeBlock
        code={'one\n<two>'}
        collapsedLines={1}
        highlight={(code) => [{ kind: 'string', text: code }]}
        onWrapChange={wrap}
        showLineNumbers
      />
    </>
  );
  expect(container.querySelector('code')).toHaveTextContent('inline');
  expect(screen.queryByText('<two>')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Show all 2 lines' }));
  expect(screen.getByText('<two>')).toBeVisible();
  expect(container.querySelector('two')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Wrap' }));
  expect(wrap).toHaveBeenCalledWith(true);
  expect(screen.getByRole('region', { name: 'Code' })).toHaveAttribute('tabindex', '0');
});
it('decodes fragmented controls, preserves earlier nodes and drops old lines', () => {
  const start = ['one\n\x1b[9', '1mtwo\x1b[0m\n\x1b]title'];
  const { rerender } = renderWithUi(<OutputLog aria-label="Output" chunks={start} />);
  const log = screen.getByRole('log', { name: 'Output' }),
    one = within(log).getByText('one');
  expect(log).toHaveAttribute('aria-live', 'off');
  expect(log).not.toHaveTextContent('title');
  rerender(<OutputLog aria-label="Output" chunks={[...start, '\x07three']} />);
  expect(within(log).getByText('one')).toBe(one);
  expect(log).toHaveTextContent('three');
  rerender(<OutputLog aria-label="Output" chunks={[...start, '\x07three']} maxLines={1} />);
  expect(log).toHaveTextContent('2 earlier lines hidden');
  expect(log).not.toHaveTextContent('two');
});
it('summarizes and expands a bounded diff, and contains malformed input', () => {
  const { rerender } = renderWithUi(
    <DiffView
      oldValue={'first\nold word\nlast\n'}
      newValue={'first\nnew word\nlast\n'}
      filename="Notes"
      maxLines={1}
      contextLines={0}
      wordDiff
    />
  );
  expect(screen.getByText('1 addition, 1 deletion')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Show full diff' }));
  expect(screen.getByRole('table', { name: /Notes/ })).toBeVisible();
  fireEvent.click(screen.getAllByRole('button', { name: /unchanged lines/ })[0]);
  expect(screen.getByText('first')).toBeVisible();
  rerender(<DiffView patch={'--- a\n+++ b\n@@ -1,3 +1,1 @@\n-invalid'} />);
  expect(screen.getByRole('alert')).toHaveTextContent('Unable to read diff');
});
it('holds open emphasis only in the active inline block', () => {
  const { container, rerender } = renderWithUi(<Markdown content="Writing **more" streaming />);
  expect(container.querySelector('strong')).toHaveTextContent('more');
  rerender(<Markdown content={'Writing **more**\n\n`**literal`'} streaming />);
  expect(container.querySelectorAll('strong')).toHaveLength(1);
  expect(container.querySelector('code')).toHaveTextContent('**literal');
});
it('keeps active markup and disallowed schemes out of rendered attributes and custom renderers', () => {
  const renderLink = vi.fn(),
    renderImage = vi.fn();
  const { container } = renderWithUi(
    <Markdown
      content={
        '<span onclick="ignored">literal</span> [local](file:///example) ![icon](data:text/plain,example) [action](javascript:void(0))'
      }
      allowedProtocols={['https', 'javascript', 'data']}
      renderLink={renderLink}
      renderImage={renderImage}
    />
  );
  expect(container.querySelector('a,img,[onclick]')).toBeNull();
  expect(renderLink).not.toHaveBeenCalled();
  expect(renderImage).not.toHaveBeenCalled();
});
