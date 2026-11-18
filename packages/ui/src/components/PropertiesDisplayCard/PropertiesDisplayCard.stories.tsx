import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Chip } from '@mui/material';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { ActionButton } from '../ActionButton';
import { PropertiesDisplayCard } from './PropertiesDisplayCard';

const meta = {
  play: checkStoryLayout,
  title: 'Components/PropertiesDisplayCard',
  component: PropertiesDisplayCard,
  parameters: { layout: 'fullscreen' },
  args: {
    title: 'Workspace details',
    subtitle: 'Current workspace configuration.',
    properties: [
      { id: 'name', label: 'Name', value: 'Epsilon research' },
      { id: 'owner', label: 'Owner', value: 'Chris' },
      { id: 'status', label: 'Status', value: <Chip label="Active" color="success" size="small" /> }
    ],
    sx: { width: '100%', maxWidth: 560 }
  }
} satisfies Meta<typeof PropertiesDisplayCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Horizontal: Story = {
  args: { properties: meta.args.properties.map((property) => ({ ...property, align: 'horizontal' })) }
};

export const WithActions: Story = {
  args: {
    headerAction: <ActionButton size="small" variant="text">Edit</ActionButton>,
    actions: [
      <ActionButton key="archive" color="error" variant="outlined">Archive</ActionButton>,
      <ActionButton key="share" variant="contained">Share</ActionButton>
    ]
  }
};

export const MissingAndFalsyValues: Story = {
  args: {
    properties: [
      { label: 'Open items', value: 0 },
      { label: 'Public', value: false },
      { label: 'Owner', value: null }
    ]
  }
};

export const Empty: Story = {
  args: { properties: [] }
};

export const Narrow: Story = {
  args: { sx: { width: 280, maxWidth: '100%' } },
  decorators: [(Story) => <Box sx={{ width: 280, maxWidth: '100%' }}><Story /></Box>]
};

export const Dark: Story = {
  decorators: [withDarkUi]
};

export const HeaderAction: Story = { args: { headerAction: <ActionButton size="small">Edit details</ActionButton> } };
export const FooterActions: Story = { args: { actions: <ActionButton>Share workspace</ActionButton> } };
export const LongContent: Story = {
  args: { title: 'Workspace details across distributed research teams', subtitle: 'Shared settings and resources', sx: { width: 280, maxWidth: '100%' },
    properties: [{ id: 'path', label: 'Workspace identifier', value: 'workspace_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz', align: 'horizontal' },
      { id: 'owner', label: 'Owner', value: <a href="#owner">Alexandria Rivera-Martinez</a>, align: 'horizontal' }],
    headerAction: <ActionButton size="small">Manage workspace</ActionButton>, actions: [<ActionButton key="export">Export properties</ActionButton>, <ActionButton key="share">Share with team</ActionButton>] }
};
