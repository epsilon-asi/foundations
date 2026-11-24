import * as React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithUi } from '../../test/renderWithUi';
import { Stack } from './Stack';
import { Box } from '../Box';
import { Text } from '../Text';
import { Divider } from '../Divider';
import { Tooltip } from '../Tooltip';
import { ScrollArea, type ScrollAreaHandle } from '../ScrollArea';
import { Tag } from '../Tag';
import { categoricalColor, categoricalPalette } from '../../theme/category';
import { Avatar } from '../Avatar';
import { Skeleton } from '../Skeleton';
import { HighlightedText } from '../HighlightedText';
import { Meter } from '../Meter';
import { StreamingIndicator } from '../StreamingIndicator';
it('uses flex gap around visible children, forwards refs and gives labelled separators semantics', () => {
  const ref = React.createRef<HTMLDivElement>();
  renderWithUi(
    <Stack ref={ref} direction="row" wrap divider={<Divider label="Next" />}>
      <Box>One</Box>
      {false}
      <Box>Two</Box>
    </Stack>
  );
  expect(ref.current).toHaveStyle({ display: 'flex', gap: 'calc(2 * var(--ui-spacing))' });
  expect(screen.getByRole('separator', { name: 'Next' })).toBeVisible();
});
it('keeps the full clamped text accessible and reveals the tooltip on keyboard focus', async () => {
  const { container } = renderWithUi(
    <Tooltip title="Details" enterDelay={0}>
      <button disabled>Open</button>
    </Tooltip>
  );
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  act(() => container.querySelector<HTMLElement>('[tabindex="0"]')!.focus());
  expect(await screen.findByRole('tooltip')).toHaveTextContent('Details');
  fireEvent.keyDown(document, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
  renderWithUi(<Text truncate>Full document name</Text>);
  expect(screen.getByText('Full document name')).toHaveStyle({ textOverflow: 'ellipsis' });
});
it('checks scroll edges and supports an imperative jump', () => {
  const end = vi.fn(),
    start = vi.fn(),
    ref = React.createRef<ScrollAreaHandle>();
  renderWithUi(
    <ScrollArea aria-label="History" onReachStart={start} onReachEnd={end} ref={ref}>
      Entries
    </ScrollArea>
  );
  const region = screen.getByRole('region', { name: 'History' });
  Object.defineProperties(region, { clientHeight: { value: 50 }, scrollHeight: { value: 200 } });
  region.scrollTop = 50;
  fireEvent.scroll(region);
  expect(region).toHaveAttribute('tabindex', '0');
  expect(ref.current?.isAtBottom()).toBe(false);
  region.scrollTop = 150;
  fireEvent.scroll(region);
  expect(end).toHaveBeenCalledTimes(1);
  ref.current?.scrollToTop();
  fireEvent.scroll(region);
  expect(start).toHaveBeenCalledTimes(1);
  ref.current?.scrollToBottom();
  expect(ref.current?.isAtBottom()).toBe(true);
});
it('keeps category assignment deterministic and exposes separate label and remove actions', () => {
  expect(Object.keys(categoricalPalette).length).toBeGreaterThanOrEqual(12);
  expect(categoricalColor(24)).toBe(categoricalColor('24'));
  const open = vi.fn(),
    remove = vi.fn();
  renderWithUi(
    <Tag label="Research" color="var(--accent)" variant="solid" size="xs" onClick={open} onRemove={remove} />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Remove Research' }));
  expect(remove).toHaveBeenCalledOnce();
  expect(open).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Research' }));
  expect(open).toHaveBeenCalledOnce();
});
it('derives initials and refuses remote image sources', () => {
  const { container } = renderWithUi(<Avatar name="Avery Lane" src="https://example.org/photo" />);
  expect(screen.getByRole('img', { name: 'Avery Lane' })).toHaveTextContent('AL');
  expect(container.querySelector('img')).toBeNull();
});
it('merges literal matches and gives explicit ranges precedence in a snippet', () => {
  const { container, rerender } = renderWithUi(<HighlightedText text="a+b A+B aab" query="a+b" />);
  expect([...container.querySelectorAll('mark')].map((n) => n.textContent)).toEqual(['a+b', 'A+B']);
  rerender(
    <HighlightedText
      text="0123456789abcdef"
      query="0"
      ranges={[
        [6, 9],
        [8, 10],
        [-9, -2]
      ]}
      snippet={{ maxLength: 8 }}
    />
  );
  expect(container.querySelector('mark')).toHaveTextContent('6789');
  expect(container.textContent).toBe('…456789ab…');
});
it('labels measured and streaming values and hides loading placeholders', () => {
  const { container } = renderWithUi(
    <>
      <Meter label="Capacity" value={130} />
      <StreamingIndicator label="Updating" />
      <Skeleton lines={3} />
    </>
  );
  expect(screen.getByRole('meter', { name: 'Capacity' })).toHaveAttribute('aria-valuenow', '100');
  expect(screen.getByRole('meter')).toHaveAttribute('aria-valuetext', '100% · High');
  expect(screen.getByRole('status', { name: 'Updating' })).toBeVisible();
  expect(container.querySelectorAll('.MuiSkeleton-root[aria-hidden=true]')).toHaveLength(3);
});
