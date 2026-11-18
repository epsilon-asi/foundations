import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '@mui/material';
import { expect, userEvent, within } from 'storybook/test';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { brokenImage, checkImageLayout, previewImage, transparentImage } from '../../../.storybook/workbenchExamples';
import { ImagePreview } from './ImagePreview';

const meta = { title: 'Components/ImagePreview', component: ImagePreview, play: checkImageLayout,
  args: { src: previewImage, alt: 'Mountain landscape' }, decorators: [Story => <Box sx={{ width: '100%', maxWidth: 480 }}><Story /></Box>]
} satisfies Meta<typeof ImagePreview>;
export default meta; type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Cover: Story = { args: { fit: 'cover', aspectRatio: 2.5 } };
export const Portrait: Story = { args: { aspectRatio: 0.75 } };
export const Transparency: Story = { args: { src: transparentImage, aspectRatio: 1, alt: 'Overlapping translucent shapes' } };
export const SolidBackground: Story = { args: { src: transparentImage, checkerboard: false } };
export const Zoom: Story = { args: { zoomable: true } };
export const Empty: Story = { args: { src: undefined } };
export const Error: Story = { args: { src: brokenImage } };
export const LongContent: Story = { args: { src: undefined, emptyMessage: 'A preview for asset_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz is not available yet.' } };
export const Narrow: Story = { decorators: [Story => <Box sx={{ width: 220, maxWidth: '100%' }}><Story /></Box>] };
export const Dark: Story = { args: { zoomable: true }, decorators: [withDarkUi] };
export const KeyboardZoom: Story = { args: { zoomable: true, maxZoom: 2 }, play: async ({ canvasElement }) => {
  await checkImageLayout({ canvasElement }); const canvas = within(canvasElement); canvas.getByRole('button', { name: 'Zoom in' }).focus();
  await userEvent.keyboard('{Enter}{Enter}'); await expect(canvas.getByText('200%')).toBeVisible(); await expect(canvas.getByRole('button', { name: 'Zoom in' })).toBeDisabled();
  await userEvent.click(canvas.getByRole('button', { name: 'Reset zoom' })); await expect(canvas.getByText('100%')).toBeVisible(); await checkImageLayout({ canvasElement });
} };
