import { createRef } from 'react';
import { screen } from '@testing-library/react';
import { renderWithUi } from '../../test/renderWithUi';
import { Keycap, ShortcutHint } from './Keycap';

it('renders semantic keyboard text and forwards refs and attributes', () => {
  const ref = createRef<HTMLElement>(); renderWithUi(<Keycap ref={ref} title="Escape key">Esc</Keycap>);
  expect(ref.current?.tagName).toBe('KBD'); expect(ref.current).toHaveAttribute('title', 'Escape key');
});
it('provides one spoken shortcut name and updates keys without registering hotkeys', () => {
  const { rerender } = renderWithUi(<ShortcutHint label="Command plus Shift plus S" keys={['⌘', '⇧', 'S']} />);
  expect(screen.getByRole('img', { name: 'Command plus Shift plus S' })).toHaveTextContent('⌘+⇧+S');
  rerender(<ShortcutHint label="Control plus S" keys={['Ctrl', 'S']} />);
  expect(screen.getByRole('img', { name: 'Control plus S' })).toHaveTextContent('Ctrl+S');
  expect(screen.queryByText('⌘')).not.toBeInTheDocument();
});
