import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '@mui/material';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { checkFeedbackLayout } from '../../../.storybook/controlExamples';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { ActionButton } from '../ActionButton';
import { Toast } from './Toast';
const meta = { title: 'Components/Toast', component: Toast, play: checkFeedbackLayout,
  args: { open: true, message: 'Your asset was saved.', severity: 'success', autoHideDuration: null },
  render: function Example(args) { const [open, setOpen] = useState(args.open); useEffect(() => setOpen(args.open), [args.open]); return <Box>
    <ActionButton onClick={() => setOpen(true)}>Show notification</ActionButton><Toast {...args} open={open} onClose={(event, reason) => { args.onClose?.(event, reason); setOpen(false); }} />
  </Box>; }
} satisfies Meta<typeof Toast>;
export default meta; type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Error: Story = { args: { severity: 'error', title: 'Save failed', message: 'Changes are still available locally.' } };
export const WithAction: Story = { args: { message: 'Asset archived.', action: <ActionButton color="inherit">Undo</ActionButton> } };
export const Filled: Story = { args: { variant: 'filled' } };
export const TopRight: Story = { args: { anchorOrigin: { vertical: 'top', horizontal: 'right' } } };
export const AutoHide: Story = { args: { autoHideDuration: 6000 } };
export const LongContent: Story = { args: { title: 'The selected production asset could not be saved to the current project', severity: 'error', message: 'project_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz', action: <ActionButton color="inherit">Review complete error details</ActionButton> } };
export const Dark: Story = { decorators: [withDarkUi] };
export const Dismissal: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement); await checkFeedbackLayout({ canvasElement, markChecked: false });
  await userEvent.click(canvas.getByRole('button', { name: 'Close notification' })); await waitFor(() => expect(canvas.queryByRole('status')).not.toBeInTheDocument());
  await userEvent.click(canvas.getByRole('button', { name: 'Show notification' })); await waitFor(() => expect(canvas.getByRole('status')).toBeVisible());
  await userEvent.keyboard('{Escape}'); await waitFor(() => expect(canvas.queryByRole('status')).not.toBeInTheDocument()); await checkFeedbackLayout({ canvasElement });
} };
