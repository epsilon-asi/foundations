import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Typography } from '@mui/material';
import { expect, userEvent, within } from 'storybook/test';
import { checkImageLayout, previewImage, transparentImage } from '../../../.storybook/workbenchExamples';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { AssetGrid } from './AssetCard';

const items = [{ id: 'coast', title: 'Coast', src: previewImage, description: '1024 × 768 · PNG' },
  { id: 'locked', title: 'Locked reference', src: previewImage, disabled: true },
  { id: 'shapes', title: 'Shapes', src: transparentImage, description: 'Transparent · SVG' }];
const meta = { title: 'Components/AssetGrid', component: AssetGrid, play: checkImageLayout, args: { 'aria-label': 'Asset library', items } } satisfies Meta<typeof AssetGrid>;
export default meta; type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const MultiSelect: Story = { args: { multiSelect: true, defaultSelectedIds: ['coast', 'shapes'] } };
export const Disabled: Story = { args: { disabled: true } };
export const Empty: Story = { args: { items: [] } };
export const ManyAssets: Story = { args: { items: Array.from({ length: 24 }, (_, i) => ({ id: String(i), title: `Reference ${i + 1}`, src: i % 2 ? transparentImage : previewImage })) } };
export const LongContent: Story = { args: { items: [{ id: 'long', title: 'asset_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz', src: previewImage, description: 'Selected character collection with complete generation settings' }] } };
export const Narrow: Story = { decorators: [Story => <Box sx={{ width: 260, maxWidth: '100%' }}><Story /></Box>] };
export const Controlled: Story = { render: function Controlled(args) { const [selected, setSelected] = useState<readonly string[]>([]); const [opened, setOpened] = useState(''); return <>
  <AssetGrid {...args} selectedIds={selected} onSelectionChange={setSelected} onOpen={item => setOpened(item.title)} /><Typography role="status">Selected: {selected.join(', ') || 'none'} · Opened: {opened || 'none'}</Typography></>; } };
export const Dark: Story = { decorators: [withDarkUi] };
export const KeyboardSelection: Story = { play: async ({ canvasElement }) => { await checkImageLayout({ canvasElement }); const canvas = within(canvasElement);
  canvas.getByRole('button', { name: 'Coast' }).focus(); await userEvent.keyboard('{ArrowRight}'); await expect(canvas.getByRole('button', { name: 'Shapes' })).toHaveFocus();
  await userEvent.keyboard(' '); await expect(canvas.getByRole('button', { name: 'Shapes' })).toHaveAttribute('aria-pressed', 'true'); await checkImageLayout({ canvasElement });
} };
