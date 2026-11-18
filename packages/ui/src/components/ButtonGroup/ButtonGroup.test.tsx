import { fireEvent, screen } from '@testing-library/react';
import { userEvent } from 'storybook/test';
import { renderWithUi } from '../../test/renderWithUi';
import { ActionButton } from '../ActionButton';
import { ButtonGroup } from './index';

it('runs each command independently and skips unavailable actions by keyboard', async () => {
  const undo = vi.fn();
  const redo = vi.fn();
  renderWithUi(
    <ButtonGroup aria-label="History commands">
      <ActionButton disabled onClick={undo}>Undo</ActionButton>
      <ActionButton onClick={redo}>Redo</ActionButton>
    </ButtonGroup>
  );
  expect(screen.getByRole('group', { name: 'History commands' })).toBeInTheDocument();
  await userEvent.tab();
  expect(screen.getByRole('button', { name: 'Redo' })).toHaveFocus();
  await userEvent.keyboard('{Enter}');
  expect(redo).toHaveBeenCalledTimes(1);
  expect(undo).not.toHaveBeenCalled();
});

it('propagates group disabled state to ActionButton and preserves its loading state', () => {
  const keep = vi.fn();
  const controls = (disabled: boolean) => (
    <ButtonGroup disabled={disabled} aria-label="Frame commands">
      <ActionButton onClick={keep}>Keep</ActionButton>
      <ActionButton loading>Save</ActionButton>
    </ButtonGroup>
  );
  const { rerender } = renderWithUi(controls(true));
  const button = screen.getByRole('button', { name: 'Keep' });
  expect(button).toBeDisabled();
  fireEvent.click(button);
  expect(keep).not.toHaveBeenCalled();
  rerender(controls(false));
  fireEvent.click(button);
  expect(keep).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
});
