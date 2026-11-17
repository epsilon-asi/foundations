import { createRef, useState } from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { userEvent } from 'storybook/test';
import { renderWithUi } from '../../test/renderWithUi';
import { ModalDialog } from './ModalDialog';

it('provides a named, described modal and forwards its root ref and content', () => {
  const ref = createRef<HTMLDivElement>();
  renderWithUi(<ModalDialog ref={ref} open title="Save asset" description="Choose a destination." transitionDuration={0}
    actions={<button>Save</button>} data-testid="modal"><input aria-label="Name" /></ModalDialog>);
  expect(screen.getByRole('dialog', { name: 'Save asset' })).toHaveAccessibleDescription('Choose a destination.');
  expect(ref.current).toBe(screen.getByTestId('modal'));
  expect(screen.getByRole('textbox', { name: 'Name' })).toBeInTheDocument();
});

it('reports close button, Escape and backdrop reasons without closing itself', async () => {
  const onClose = vi.fn();
  renderWithUi(<ModalDialog open title="Details" onClose={onClose} transitionDuration={0} />);
  fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
  expect(onClose).toHaveBeenLastCalledWith(expect.anything(), 'closeButtonClick');
  await userEvent.keyboard('{Escape}');
  expect(onClose).toHaveBeenLastCalledWith(expect.anything(), 'escapeKeyDown');
  const container = screen.getByRole('dialog').parentElement!;
  fireEvent.mouseDown(container);
  fireEvent.click(container);
  expect(onClose).toHaveBeenLastCalledWith(expect.anything(), 'backdropClick');
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});

it('prevents dismissal while busy and supports disabling individual dismissal methods', async () => {
  const onClose = vi.fn();
  const { rerender } = renderWithUi(<ModalDialog open title="Saving" busy onClose={onClose} transitionDuration={0} />);
  expect(screen.getByRole('button', { name: 'Close dialog' })).toBeDisabled();
  await userEvent.keyboard('{Escape}');
  const container = screen.getByRole('dialog').parentElement!;
  fireEvent.mouseDown(container); fireEvent.click(container);
  expect(onClose).not.toHaveBeenCalled();
  rerender(<ModalDialog open title="Saving" onClose={onClose} closeButton={false} disableEscapeKeyDown transitionDuration={0} />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  await userEvent.keyboard('{Escape}');
  expect(onClose).not.toHaveBeenCalled();
});

it('traps keyboard focus and returns it to the opener after dismissal', async () => {
  function Example() {
    const [open, setOpen] = useState(false);
    return <><button onClick={() => setOpen(true)}>Open</button><ModalDialog open={open} title="Edit" closeButton={false}
      transitionDuration={0} onClose={() => setOpen(false)} actions={<button>Save</button>}>
      <input autoFocus aria-label="Name" />
    </ModalDialog></>;
  }
  renderWithUi(<Example />);
  await userEvent.click(screen.getByRole('button', { name: 'Open' }));
  expect(screen.getByRole('textbox')).toHaveFocus();
  await userEvent.tab({ shift: true });
  expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
  await userEvent.tab();
  expect(screen.getByRole('textbox')).toHaveFocus();
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus();
});

it('supports custom accessibility associations and no close button without a handler', () => {
  renderWithUi(<ModalDialog open title="Visible title" aria-labelledby="custom-title" aria-describedby="custom-description"
    transitionDuration={0}><span id="custom-title">Custom name</span><span id="custom-description">Custom description</span></ModalDialog>);
  expect(screen.getByRole('dialog', { name: 'Custom name' })).toHaveAccessibleDescription('Custom description');
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
