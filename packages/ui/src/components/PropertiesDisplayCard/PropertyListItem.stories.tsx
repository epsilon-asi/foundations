import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Chip } from '@mui/material';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { PropertyListItem } from './PropertiesDisplayCard';

const meta = {
  play: checkStoryLayout,
  title: 'Components/PropertyListItem',
  component: PropertyListItem,
  args: { label: 'Workspace', value: 'Epsilon research' },
  decorators: [(Story) => <Box component="dl" sx={{ m: 0, width: 'min(560px, 100%)' }}><Story /></Box>]
} satisfies Meta<typeof PropertyListItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Vertical: Story = {};
export const Horizontal: Story = { args: { align: 'horizontal' } };
export const RichValue: Story = { args: { label: 'Status', value: <Chip label="Active" color="success" size="small" /> } };
export const CustomChildren: Story = { args: { children: <a href="#owner">View workspace owner</a> } };
export const Zero: Story = { args: { label: 'Open items', value: 0 } };
export const Boolean: Story = { args: { label: 'Public', value: false } };
export const Missing: Story = { args: { value: undefined } };
export const CustomEmptyValue: Story = { args: { value: null, emptyValue: 'Unassigned' } };
export const WithoutGutters: Story = { args: { disableGutters: true } };
export const Narrow: Story = { args: { align: 'horizontal', value: 'workspace_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz', sx: { width: 280, maxWidth: '100%' } } };
export const Dark: Story = { decorators: [withDarkUi] };
