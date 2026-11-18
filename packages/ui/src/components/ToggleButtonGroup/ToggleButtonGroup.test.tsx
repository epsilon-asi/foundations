import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { userEvent } from 'storybook/test';
import { renderWithUi } from '../../test/renderWithUi';
import { ToggleButton, ToggleButtonGroup } from './index';

it.each([true, false])('supports controlled exclusive selection with required=%s', async (required) => {
  function Scope() {
    const [selected, setSelected] = useState<string | null>('frame');
    return (
      <ToggleButtonGroup aria-label="Scope" exclusive value={selected}
        onChange={(_event, next: string | null) => { if (!required || next !== null) setSelected(next); }}>
        <ToggleButton value="frame">Frame</ToggleButton>
        <ToggleButton value="selection">Selection</ToggleButton>
      </ToggleButtonGroup>
    );
  }
  renderWithUi(<Scope />);
  const frame = screen.getByRole('button', { name: 'Frame', pressed: true });
  const selection = screen.getByRole('button', { name: 'Selection', pressed: false });
  selection.focus();
  await userEvent.keyboard('{Enter}');
  expect(frame).toHaveAttribute('aria-pressed', 'false');
  expect(selection).toHaveAttribute('aria-pressed', 'true');
  await userEvent.keyboard(' ');
  expect(selection).toHaveAttribute('aria-pressed', String(required));
});

it('proposes original numeric values and leaves multiple selection under caller control', () => {
  const changed = vi.fn();
  const choices = (value: number[]) => (
    <ToggleButtonGroup aria-label="Angles" value={value} onChange={changed}>
      <ToggleButton value={0}>Front</ToggleButton>
      <ToggleButton value={90}>Side</ToggleButton>
      <ToggleButton value={180} disabled>Back</ToggleButton>
    </ToggleButtonGroup>
  );
  const { rerender } = renderWithUi(choices([0]));
  const side = screen.getByRole('button', { name: 'Side', pressed: false });
  fireEvent.click(side);
  expect(changed).toHaveBeenLastCalledWith(expect.anything(), [0, 90]);
  expect(side).toHaveAttribute('aria-pressed', 'false');
  rerender(choices([0, 90]));
  expect(side).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Front' }));
  expect(changed).toHaveBeenLastCalledWith(expect.anything(), [90]);
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(changed).toHaveBeenCalledTimes(2);
  rerender(choices([90]));
  fireEvent.click(side);
  expect(changed).toHaveBeenLastCalledWith(expect.anything(), []);
});
