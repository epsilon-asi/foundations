import { createRef } from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { mockMenuAnchorLayout, testMenuTrigger } from '../../test/menuTriggerContract';
import { renderWithUi } from '../../test/renderWithUi';
import { ChipMenu } from './ChipMenu';

testMenuTrigger('ChipMenu', (props) => <ChipMenu label="Options" {...props} />);

it.each(['Enter', ' '])('opens the chip menu with the %s key', async (key) => {
  mockMenuAnchorLayout();
  try {
    renderWithUi(<ChipMenu label="Options" items={[{ id: 'open', label: 'Open' }]} />);
    const trigger = screen.getByRole('button', { name: 'Options' });
    trigger.focus();
    fireEvent.keyDown(trigger, { key });
    fireEvent.keyUp(trigger, { key });
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Open' })).toHaveFocus());
  } finally {
    vi.restoreAllMocks();
  }
});

it('forwards chip props and refs without a destructive delete control', () => {
  const ref = createRef<HTMLDivElement>();
  renderWithUi(<ChipMenu ref={ref} label="Options" items={[]} color="primary" variant="outlined" sx={{ padding: '12px' }} />);
  expect(ref.current).toBe(screen.getByRole('button', { name: 'Options' }));
  expect(ref.current).toHaveStyle({ padding: '12px' });
  expect(screen.getAllByRole('button')).toHaveLength(1);
});
