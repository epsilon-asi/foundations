import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Typography } from '@mui/material';
import { expect, userEvent, waitFor, within, fn } from 'storybook/test';
import { checkOverlayLayout } from '../../../.storybook/overlayExamples';
import { exampleFiles } from '../../../.storybook/fileExamples';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { ActionButton } from '../ActionButton';
import { UploadDialog } from './UploadDialog';
const files = exampleFiles();
const retrySubmit = fn(async () => {});
const meta = { title: 'Components/UploadDialog', component: UploadDialog, play: checkOverlayLayout,
  args: { open: false, onSubmit: fn(async () => {}) },
  render: function Example(args) { const [open, setOpen] = useState(args.open); const [result, setResult] = useState(''); useEffect(() => setOpen(args.open), [args.open]);
    return <Box><ActionButton onClick={() => setOpen(true)}>Open upload dialog</ActionButton><Typography role="status">{result}</Typography>
      <UploadDialog {...args} open={open} onClose={(event, reason) => { args.onClose?.(event, reason); setOpen(false); }} onSubmitSuccess={() => {
        args.onSubmitSuccess?.(); setResult('Files accepted by the caller'); setOpen(false);
      }} />
    </Box>;
  }
} satisfies Meta<typeof UploadDialog>;
export default meta; type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Open: Story = { args: { open: true } };
export const WithFiles: Story = { args: { open: true, defaultFiles: files } };
export const Busy: Story = { args: { open: true, defaultFiles: files, busy: true } };
export const LongContent: Story = { args: { open: true, title: 'Add production-ready creative assets and supporting project documentation', description: 'project_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz', defaultFiles: [new File(['Asset'], 'asset_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz.production-notes.txt')], submitLabel: 'Add all files to the current project' } };
export const Dark: Story = { args: { open: true, defaultFiles: files }, decorators: [withDarkUi] };
export const FailureAndRetry: Story = { args: { open: true, defaultFiles: files, onSubmit: retrySubmit },
  play: async ({ canvasElement }) => {
    retrySubmit.mockReset().mockRejectedValueOnce(new Error('Connection unavailable. Your files are still selected.')).mockResolvedValue(undefined);
    const body = within(canvasElement.ownerDocument.body); await userEvent.click(body.getByRole('button', { name: 'Upload files' }));
    await expect(await body.findByRole('alert')).toHaveTextContent('Connection unavailable'); await expect(body.getByText('character-preview.png')).toBeVisible();
    await checkOverlayLayout({ canvasElement, markChecked: false }); await userEvent.click(body.getByRole('button', { name: 'Upload files' }));
    await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument()); await checkOverlayLayout({ canvasElement });
} };
export const KeyboardAndSubmission: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement); const body = within(canvasElement.ownerDocument.body);
  await userEvent.click(canvas.getByRole('button', { name: 'Open upload dialog' }));
  await userEvent.upload(body.getByLabelText('Choose files', { selector: 'input' }), files); await checkOverlayLayout({ canvasElement, markChecked: false });
  await userEvent.click(body.getByRole('button', { name: 'Cancel' })); await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument());
  await expect(canvas.getByRole('button', { name: 'Open upload dialog' })).toHaveFocus();
  await userEvent.click(canvas.getByRole('button', { name: 'Open upload dialog' })); await expect(body.queryByText('character-preview.png')).not.toBeInTheDocument();
  await userEvent.upload(body.getByLabelText('Choose files', { selector: 'input' }), files); await userEvent.click(body.getByRole('button', { name: 'Upload files' }));
  await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument()); await expect(canvas.getByRole('status')).toHaveTextContent('Files accepted'); await checkOverlayLayout({ canvasElement });
} };
