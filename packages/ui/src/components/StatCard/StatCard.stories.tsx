import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { Box } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import TrendingUpRounded from '@mui/icons-material/TrendingUpRounded';
import WarningAmberRounded from '@mui/icons-material/WarningAmberRounded';
import { StatCard } from './StatCard';

const meta = {
  play: checkStoryLayout,
  title: 'Components/StatCard',
  component: StatCard,
  args: {
    sx: { width: 'min(380px, calc(100vw - 32px))' },
    title: 'Monthly recurring revenue',
    value: '$128,400',
    description: 'Compared to the previous 30 days',
    trendLabel: '+12.4%',
    icon: <TrendingUpRounded fontSize="inherit" />
  }
} satisfies Meta<typeof StatCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Positive: Story = {};

export const Warning: Story = {
  args: {
    title: 'Outstanding invoices',
    value: '24',
    trendLabel: 'Needs review',
    tone: 'warning',
    icon: <WarningAmberRounded fontSize="inherit" />
  }
};

export const Neutral: Story = {
  args: {
    trendLabel: 'Stable',
    tone: 'neutral'
  }
};

export const Danger: Story = { args: { title: 'Failed exports', value: '12', tone: 'danger', trendLabel: 'Needs attention' } };
export const Minimal: Story = { args: { description: undefined, icon: undefined, trendLabel: undefined } };
export const WithEyebrow: Story = { args: { eyebrow: 'Workspace activity' } };
export const Narrow: Story = { args: { sx: { width: 280, maxWidth: '100%' } } };
export const LongContent: Story = { args: { title: 'Workspace activity across all research teams', value: '$123,456,789.00', description: 'workspace_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz', trendLabel: 'Compared with all activity from the previous reporting period', sx: { width: 280, maxWidth: '100%' } } };
export const Dark: Story = {
  decorators: [withDarkUi],
  render: (args) => <Box sx={{ display: 'grid', gap: 2 }}>{(['positive', 'neutral', 'warning', 'danger'] as const).map((tone) =>
    <StatCard {...args} key={tone} tone={tone} eyebrow={tone} />
  )}</Box>
};
