import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { Typography } from '@mui/material';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import type { Meta, StoryObj } from '@storybook/react-vite';
import InboxRounded from '@mui/icons-material/InboxRounded';
import { ActionButton } from '../ActionButton';
import { EmptyState } from './EmptyState';

const meta = {
  play: checkStoryLayout,
  title: 'Components/EmptyState',
  component: EmptyState,
  args: {
    sx: { width: 'min(560px, calc(100vw - 32px))' },
    title: 'No invoices yet',
    description: 'Create your first invoice to see recent activity in this view.',
    icon: <InboxRounded fontSize="inherit" />,
    action: <ActionButton>Create invoice</ActionButton>
  }
} satisfies Meta<typeof EmptyState>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Compact: Story = {
  args: {
    compact: true
  }
};

export const Minimal: Story = { args: { description: undefined, icon: undefined, action: undefined } };
export const WithoutAction: Story = { args: { action: undefined } };
export const WithContent: Story = { args: { children: <Typography variant="caption">Try adjusting your filters.</Typography> } };
export const Narrow: Story = { args: { sx: { width: 280, maxWidth: '100%' } } };
export const LongContent: Story = { args: { title: 'There are no shared workspaces available to review yet', description: 'workspace_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz', sx: { width: 280, maxWidth: '100%' } } };
export const Dark: Story = { decorators: [withDarkUi] };
