import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Typography } from '@mui/material';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { ActionButton } from '../ActionButton';
import { PropertiesDisplayCard } from '../PropertiesDisplayCard';
import { Panel } from './Panel';

const meta = {
  title: 'Components/Panel', component: Panel, play: checkStoryLayout,
  args: { title: 'Asset properties', subtitle: 'Details for the selected revision.', children: <Typography>Choose an asset to inspect its properties.</Typography> }
} satisfies Meta<typeof Panel>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Compact: Story = { args: { density: 'compact' } };
export const HeaderAction: Story = { args: { headerAction: <ActionButton size="small" variant="text">Refresh</ActionButton> } };
export const Footer: Story = { args: { footer: <><ActionButton size="small">Apply changes</ActionButton><ActionButton size="small" variant="text">Reset</ActionButton></> } };
export const BodyOnly: Story = { args: { title: undefined, subtitle: undefined } };
export const RichContent: Story = { args: { children: <PropertiesDisplayCard title="Metadata" properties={[{ label: 'Width', value: '64 px' }, { label: 'Height', value: '64 px' }, { label: 'Frames', value: 0 }, { label: 'Approved', value: false }]} /> } };
export const Scrollable: Story = { args: { contentSx: { maxHeight: 240, overflow: 'auto' },
  children: <Box sx={{ display: 'grid', gap: 2 }}>{Array.from({ length: 30 }, (_, index) => <Typography key={index}>Revision {index + 1}</Typography>)}</Box> } };
export const Elevated: Story = { args: { variant: 'elevation', elevation: 3 } };
export const Narrow: Story = { args: { headerAction: <ActionButton size="small">Download settings</ActionButton> },
  decorators: [(Story) => <Box sx={{ width: 260, maxWidth: '100%' }}><Story /></Box>] };
export const LongContent: Story = { args: { title: 'Generation settings for the complete selected character collection',
  subtitle: 'asset_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz',
  headerAction: <ActionButton size="small">Refresh all properties</ActionButton>,
  children: 'asset_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz' } };
export const Dark: Story = { decorators: [withDarkUi] };
