import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, TextField, Typography } from '@mui/material';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { checkOverlayLayout } from '../../../.storybook/overlayExamples';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { ActionButton } from '../ActionButton';
import { Popover } from './Popover';

const meta = { title: 'Components/Popover', component: Popover, play: checkOverlayLayout,
  args: { open: false, title: 'Layer settings', description: 'Edit appearance for the current selection.', children: <TextField autoFocus label="Layer name" defaultValue="Foreground" fullWidth /> },
  render: function Example(args) {
    const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null); const [open, setOpen] = useState(args.open);
    useEffect(() => setOpen(args.open), [args.open]);
    return <><ActionButton ref={setAnchor} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>Edit layer</ActionButton>
      <Popover {...args} anchorEl={anchor} open={open && !!anchor} onClose={(event, reason) => { args.onClose?.(event, reason); setOpen(false); }} /></>;
  }
} satisfies Meta<typeof Popover>;
export default meta; type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Open: Story = { args: { open: true } };
export const Actions: Story = { args: { open: true, actions: <ActionButton>Apply settings</ActionButton> } };
export const BodyOnly: Story = { args: { open: true, title: undefined, description: undefined, 'aria-label': 'Layer editor' } };
export const LongContent: Story = { args: { open: true, title: 'Appearance settings for all selected character and environment layers',
  description: 'asset_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz', children: <Box sx={{ display: 'grid', gap: 2 }}>{Array.from({ length: 35 }, (_, i) => <Typography key={i}>Setting {i + 1}: Detailed layer settings.</Typography>)}</Box> } };
export const Narrow: Story = { args: { open: true, slotProps: { paper: { sx: { width: 240 } } } } };
export const Dark: Story = { args: { open: true }, decorators: [withDarkUi] };
export const KeyboardAndFocus: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement); const body = within(canvasElement.ownerDocument.body);
  await userEvent.click(canvas.getByRole('button', { name: 'Edit layer' })); await waitFor(() => expect(body.getByRole('dialog')).toBeVisible());
  await expect(body.getByRole('textbox', { name: 'Layer name' })).toHaveFocus(); await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument()); await expect(canvas.getByRole('button', { name: 'Edit layer' })).toHaveFocus();
  await checkStoryLayout({ canvasElement });
} };
