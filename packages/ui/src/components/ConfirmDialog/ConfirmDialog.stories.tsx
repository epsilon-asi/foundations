import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Typography } from '@mui/material';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { checkOverlayLayout } from '../../../.storybook/overlayExamples';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { ActionButton } from '../ActionButton';
import { ConfirmDialog } from './ConfirmDialog';

const meta = {
  title: 'Components/ConfirmDialog', component: ConfirmDialog, play: checkOverlayLayout,
  args: { open: true, onClose: fn(), onConfirm: fn(), title: 'Save this revision?', description: 'The current working copy will be saved as a new revision.' },
  render: function Example(args) {
    const [open, setOpen] = useState(args.open); const [message, setMessage] = useState('');
    useEffect(() => setOpen(args.open), [args.open]);
    return <><ActionButton onClick={() => setOpen(true)}>Open confirmation</ActionButton><Typography role="status">{message}</Typography>
      <ConfirmDialog {...args} open={open} onClose={(event, reason) => { args.onClose?.(event, reason); setOpen(false); setMessage(`Closed: ${reason}`); }}
        onConfirm={(event) => { args.onConfirm?.(event); setOpen(false); setMessage('Confirmed'); }} />
    </>;
  }
} satisfies Meta<typeof ConfirmDialog>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Destructive: Story = { args: { destructive: true, title: 'Discard this working copy?', confirmLabel: 'Discard', description: 'This removes the working copy permanently.' } };
export const Busy: Story = { args: { busy: true, busyLabel: 'Saving revision…' } };
export const Disabled: Story = { args: { confirmDisabled: true, description: 'Choose a destination before saving.' } };
export const Error: Story = { args: { error: 'The destination could not be written. Try again.' } };
export const CustomLabels: Story = { args: { title: 'Send assets?', confirmLabel: 'Send 4 assets', cancelLabel: 'Keep reviewing' } };
export const WithContent: Story = { args: { children: <ul><li>Forest guardian · Revision 3</li><li>Moonlit clearing · Revision 8</li></ul> } };
export const NoCloseButton: Story = { args: { closeButton: false } };
export const LongContent: Story = { args: { title: 'Permanently discard all selected working copies from this collection?',
  description: 'asset_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz',
  confirmLabel: 'Discard all selected working copies', cancelLabel: 'Return to reviewing the collection', destructive: true } };
export const Dark: Story = { decorators: [withDarkUi] };
export const ConfirmInteraction: Story = { play: async ({ canvasElement }) => {
  const body = within(canvasElement.ownerDocument.body);
  await expect(body.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  await checkOverlayLayout({ canvasElement, markChecked: false });
  await userEvent.click(body.getByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(body.queryByRole('alertdialog')).not.toBeInTheDocument());
  await expect(within(canvasElement).getByRole('status')).toHaveTextContent('Confirmed');
  await checkOverlayLayout({ canvasElement });
} };
