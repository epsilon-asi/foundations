import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Typography } from '@mui/material';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { checkOverlayLayout } from '../../../.storybook/overlayExamples';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { ActionButton } from '../ActionButton';
import { PropertiesDisplayCard } from '../PropertiesDisplayCard';
import { Drawer } from './Drawer';

const meta = {
  title: 'Components/Drawer', component: Drawer, play: checkOverlayLayout,
  args: { open: false, title: 'Asset properties', subtitle: 'Forest guardian · Revision 3', children:
    <PropertiesDisplayCard title="Metadata" properties={[{ label: 'Size', value: '1024 × 1024 px' }, { label: 'Frames', value: 24 }, { label: 'Approved', value: false }]} /> },
  render: function Example(args) {
    const [open, setOpen] = useState(args.open); const [reason, setReason] = useState('');
    useEffect(() => setOpen(args.open), [args.open]);
    return <Box sx={{ minWidth: 0 }}><ActionButton onClick={() => setOpen(true)}>Open drawer</ActionButton><Typography role="status">{reason}</Typography>
      <Drawer {...args} open={open} onClose={(event, why) => { args.onClose?.(event, why); setOpen(false); setReason(`Closed: ${why}`); }} />
    </Box>;
  }
} satisfies Meta<typeof Drawer>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Right: Story = { args: { open: true } };
export const Left: Story = { args: { open: true, anchor: 'left' } };
export const Top: Story = { args: { open: true, anchor: 'top' } };
export const Bottom: Story = { args: { open: true, anchor: 'bottom' } };
export const Persistent: Story = { args: { open: true, variant: 'persistent', width: 260 },
  decorators: [(Story) => <Box sx={{ height: 440, position: 'relative', overflow: 'hidden', '& .MuiDrawer-paper': { position: 'absolute' } }}><Story /></Box>] };
export const Permanent: Story = { args: { open: true, variant: 'permanent', width: 260, closeButton: false },
  decorators: [(Story) => <Box sx={{ height: 440, position: 'relative', overflow: 'hidden', '& .MuiDrawer-paper': { position: 'absolute' } }}><Story /></Box>] };
export const WithActions: Story = { args: { open: true, actions: <><ActionButton>Save changes</ActionButton><ActionButton variant="text">Reset</ActionButton></> } };
export const Busy: Story = { args: { open: true, busy: true, subtitle: 'Saving changes…', actions: <ActionButton loading>Save changes</ActionButton> } };
export const NoCloseButton: Story = { args: { open: true, closeButton: false } };
export const Wide: Story = { args: { open: true, width: 640 } };
export const LongContent: Story = { args: { open: true, title: 'Properties and generation settings for the selected character concept',
  subtitle: 'asset_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz',
  children: <Box sx={{ display: 'grid', gap: 2 }}>{Array.from({ length: 30 }, (_, index) => <Typography key={index}>Setting {index + 1}: Detailed metadata for the selected asset.</Typography>)}</Box>,
  actions: <ActionButton>Download complete asset package</ActionButton> } };
export const Dark: Story = { args: { open: true }, decorators: [withDarkUi] };
export const KeyboardAndFocus: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement); const body = within(canvasElement.ownerDocument.body);
  await userEvent.click(canvas.getByRole('button', { name: 'Open drawer' }));
  await waitFor(() => expect(body.getByRole('dialog')).toBeVisible());
  await checkOverlayLayout({ canvasElement, markChecked: false });
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument());
  await expect(canvas.getByRole('button', { name: 'Open drawer' })).toHaveFocus();
  await checkOverlayLayout({ canvasElement });
} };
