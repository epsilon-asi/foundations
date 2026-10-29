import type { Meta, StoryObj } from '@storybook/react-vite';
import InboxRounded from '@mui/icons-material/InboxRounded';
import { ActionButton } from '../ActionButton';
import { EmptyState } from './EmptyState';

const meta = {
  title: 'Components/EmptyState',
  component: EmptyState,
  args: {
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
