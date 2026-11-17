import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, TextField, Typography } from '@mui/material';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { checkOverlayLayout } from '../../../.storybook/overlayExamples';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { ActionButton } from '../ActionButton';
import { ModalDialog } from './ModalDialog';

const meta = {
  title: 'Components/ModalDialog', component: ModalDialog, play: checkOverlayLayout,
  args: { open: false, title: 'Asset details', description: 'Review this asset before continuing.',
    children: <Typography>Character concept · 1024 × 1024 px · Revision 3</Typography> },
  render: function Example(args) {
    const [open, setOpen] = useState(args.open);
    const [message, setMessage] = useState('');
    useEffect(() => setOpen(args.open), [args.open]);
    return <><ActionButton onClick={() => setOpen(true)}>Open dialog</ActionButton><Typography role="status">{message}</Typography>
      <ModalDialog {...args} open={open} onClose={(event, reason) => { args.onClose?.(event, reason); setOpen(false); setMessage(`Closed: ${reason}`); }} />
    </>;
  }
} satisfies Meta<typeof ModalDialog>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Open: Story = { args: { open: true } };
export const WithActions: Story = { args: { open: true, actions: <ActionButton>Download asset</ActionButton> } };
export const ContentOnly: Story = { args: { open: true, description: undefined, closeButton: false } };
export const WithFields: Story = { args: { open: true, title: 'Save asset', children: <TextField autoFocus label="Asset name" defaultValue="Forest guardian" fullWidth /> } };
export const Busy: Story = { args: { open: true, busy: true, description: 'Saving this asset…', actions: <ActionButton loading>Save</ActionButton> } };
export const FullScreen: Story = { args: { open: true, fullScreen: true } };
export const Narrow: Story = { args: { open: true, maxWidth: 'xs' } };
export const Wide: Story = { args: { open: true, maxWidth: 'lg' } };
export const LongContent: Story = { args: { open: true, title: 'Review the complete generation settings for the selected character concept',
  description: 'asset_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz',
  children: <Box sx={{ display: 'grid', gap: 2 }}>{Array.from({ length: 24 }, (_, index) => <Typography key={index}>Setting {index + 1}: Detailed metadata for the selected asset.</Typography>)}</Box>,
  actions: <><ActionButton>Download complete asset package</ActionButton><ActionButton variant="text">Copy generation settings</ActionButton></> } };
export const Dark: Story = { args: { open: true }, decorators: [withDarkUi] };
export const KeyboardAndFocus: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement); const body = within(canvasElement.ownerDocument.body);
  await userEvent.click(canvas.getByRole('button', { name: 'Open dialog' }));
  await waitFor(() => expect(body.getByRole('dialog')).toBeVisible());
  await checkOverlayLayout({ canvasElement, markChecked: false });
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument());
  await expect(canvas.getByRole('button', { name: 'Open dialog' })).toHaveFocus();
  await checkStoryLayout({ canvasElement });
} };
