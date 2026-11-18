import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Typography } from '@mui/material';
import { checkImageLayout, previewImage, transparentImage, brokenImage } from '../../../.storybook/workbenchExamples';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { StatusBadge } from '../StatusBadge';
import { ActionButton } from '../ActionButton';
import { AssetCard } from './AssetCard';

const meta = { title: 'Components/AssetCard', component: AssetCard, play: checkImageLayout,
  args: { title: 'Coastal study', src: previewImage, description: '1024 × 768 · PNG' },
  decorators: [Story => <Box sx={{ width: '100%', maxWidth: 240 }}><Story /></Box>],
  render: function Example(args) { const [selected, setSelected] = useState(args.selected ?? false); const [action, setAction] = useState('');
    useEffect(() => setSelected(args.selected ?? false), [args.selected]);
    return <><AssetCard {...args} selected={selected} onSelect={() => setSelected(!selected)} onOpen={() => setAction('Opened asset')} actions={<ActionButton disabled={args.disabled} onClick={() => setAction('Downloaded asset')}>Download</ActionButton>} /><Typography role="status">{action}</Typography></>;
  }
} satisfies Meta<typeof AssetCard>;
export default meta; type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Selected: Story = { args: { selected: true } };
export const Disabled: Story = { args: { disabled: true } };
export const Badge: Story = { args: { badge: <StatusBadge label="Approved" tone="success" /> } };
export const Transparency: Story = { args: { src: transparentImage } };
export const MissingPreview: Story = { args: { src: undefined } };
export const FailedPreview: Story = { args: { src: brokenImage } };
export const Static: Story = { render: args => <AssetCard {...args} /> };
export const LongContent: Story = { args: { title: 'asset_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz', description: 'A complete collection of character references and generation metadata.' } };
export const Narrow: Story = { decorators: [Story => <Box sx={{ width: 160, maxWidth: '100%' }}><Story /></Box>] };
export const Dark: Story = { decorators: [withDarkUi] };
