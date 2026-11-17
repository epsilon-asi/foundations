import { createRef } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithUi } from '../../test/renderWithUi';
import { IconButton } from './IconButton';

describe('IconButton', () => {
  it('renders a named native button and forwards clicks', () => {
    const onClick = vi.fn();
    renderWithUi(<IconButton aria-label="Open settings" onClick={onClick}><span aria-hidden="true">⚙</span></IconButton>);
    const button = screen.getByRole('button', { name: 'Open settings' });
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveAttribute('type', 'button');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('prevents activation when disabled and preserves its accessible name', () => {
    const onClick = vi.fn();
    renderWithUi(<IconButton aria-label="Delete item" disabled onClick={onClick}>×</IconButton>);
    const button = screen.getByRole('button', { name: 'Delete item' });
    fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('shows a tooltip on the wrapper of a disabled button', async () => {
    renderWithUi(<IconButton aria-label="Delete" disabled tooltip="You need edit access">×</IconButton>);
    fireEvent.mouseOver(screen.getByRole('button', { name: 'Delete' }).parentElement!);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('You need edit access');
  });

  it('forwards refs, keyboard callbacks and theme-aware style overrides', () => {
    const ref = createRef<HTMLButtonElement>();
    const onKeyDown = vi.fn();
    renderWithUi(<IconButton ref={ref} aria-label="Open" variant="round" onKeyDown={onKeyDown}
      sx={[{ padding: '1px' }, (theme) => ({ padding: `${theme.shape.borderRadius}px` })]}>+</IconButton>);
    const button = screen.getByRole('button', { name: 'Open' });
    button.focus();
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(ref.current).toBe(button);
    expect(button).toHaveFocus();
    expect(button).toHaveStyle({ padding: '14px', borderRadius: '50%' });
  });
});
