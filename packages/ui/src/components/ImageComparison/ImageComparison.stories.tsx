import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Typography } from '@mui/material';
import { expect, userEvent, within } from 'storybook/test';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { brokenImage, checkImageLayout, previewImage, transparentImage } from '../../../.storybook/workbenchExamples';
import { editedPreviewImage } from '../../../.storybook/collectionExamples';
import { ImageComparison } from './ImageComparison';

const meta = { title: 'Components/ImageComparison', component: ImageComparison, play: checkImageLayout,
  args: { 'aria-label': 'Revision comparison', before: { src: previewImage, alt: 'Original mountain landscape', label: 'Original' }, after: { src: editedPreviewImage, alt: 'Edited mountain landscape', label: 'Edited' } },
  decorators: [Story => <Box sx={{ width: '100%', maxWidth: 640 }}><Story /></Box>]
} satisfies Meta<typeof ImageComparison>;
export default meta; type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const SideBySide: Story = { args: { mode: 'side-by-side' } };
export const BeforeOnly: Story = { args: { defaultPosition: 100 } };
export const AfterOnly: Story = { args: { defaultPosition: 0 } };
export const Disabled: Story = { args: { disabled: true } };
export const Transparency: Story = { args: { before: { src: transparentImage, alt: 'Translucent shapes' }, after: { src: previewImage, alt: 'Landscape' } } };
export const Cover: Story = { args: { fit: 'cover', aspectRatio: 2 } };
export const MissingImage: Story = { args: { before: { alt: 'Original revision' } } };
export const FailedImage: Story = { args: { after: { src: brokenImage, alt: 'Edited revision' } } };
export const LongLabels: Story = { args: { before: { src: previewImage, alt: 'Original', label: 'original_abcdefghijklmnopqrstuvwxyz_0123456789' }, after: { src: editedPreviewImage, alt: 'Edited', label: 'edited_abcdefghijklmnopqrstuvwxyz_0123456789' } } };
export const Narrow: Story = { decorators: [Story => <Box sx={{ width: 240, maxWidth: '100%' }}><Story /></Box>] };
export const Dark: Story = { decorators: [withDarkUi] };
export const Controlled: Story = { render: function Controlled(args) { const [position, setPosition] = useState(30); return <><ImageComparison {...args} position={position} onPositionChange={setPosition} /><Typography role="status">Before visible: {position}%</Typography></>; } };
export const Keyboard: Story = { play: async ({ canvasElement }) => { const canvas = within(canvasElement); const slider = canvas.getByRole('slider', { name: 'Before image visibility' });
  slider.focus(); await userEvent.keyboard('{ArrowRight}{ArrowRight}'); await expect(slider).toHaveValue('52'); await userEvent.keyboard('{End}'); await expect(slider).toHaveValue('100'); await checkImageLayout({ canvasElement });
} };
