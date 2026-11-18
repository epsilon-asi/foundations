import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within, fn } from 'storybook/test';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { controlContainer } from '../../../.storybook/controlExamples';
import { exampleFiles } from '../../../.storybook/fileExamples';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { FileDropzone } from './FileDropzone';
const files = exampleFiles();
const meta = { title: 'Components/FileDropzone', component: FileDropzone, play: checkStoryLayout,
  args: { label: 'Project files', onFilesChange: fn(), onDrop: fn() }, decorators: [controlContainer]
} satisfies Meta<typeof FileDropzone>;
export default meta; type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const SelectedFiles: Story = { args: { defaultFiles: files } };
export const ImagesOnly: Story = { args: { accept: ['image/*', '.png', '.jpg'], helperText: 'PNG or JPEG images, up to 5 MB each.', maxSize: 5 * 1024 * 1024 } };
export const SingleFile: Story = { args: { multiple: false, defaultFiles: files.slice(0, 1) } };
export const Disabled: Story = { args: { disabled: true, defaultFiles: files } };
export const ReadOnly: Story = { args: { readOnly: true, defaultFiles: files } };
export const Busy: Story = { args: { busy: true, defaultFiles: files, helperText: 'The caller is processing the selected files.' } };
export const LongNames: Story = { args: { defaultFiles: [new File(['Asset'], 'asset_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz.production-notes.txt', { type: 'text/plain' })], helperText: 'project_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz' } };
export const Dark: Story = { args: { defaultFiles: files }, decorators: [withDarkUi] };
export const SelectionAndRejection: Story = { args: { accept: '.png', maxFiles: 1 }, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement); const picker = canvas.getByLabelText('Choose files', { selector: 'input' });
  await userEvent.upload(picker, files, { applyAccept: false }); await expect(canvas.getByRole('alert')).toHaveTextContent('production-notes.txt');
  await expect(canvas.getByRole('list', { name: 'Selected files' })).toHaveTextContent('character-preview.png');
  await checkStoryLayout({ canvasElement, markChecked: false }); await userEvent.click(canvas.getByRole('button', { name: 'Remove character-preview.png' }));
  await expect(canvas.queryByRole('list', { name: 'Selected files' })).not.toBeInTheDocument(); await checkStoryLayout({ canvasElement });
} };
