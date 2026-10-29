import type { Meta, StoryObj } from '@storybook/react-vite';
import TrendingUpRounded from '@mui/icons-material/TrendingUpRounded';
import WarningAmberRounded from '@mui/icons-material/WarningAmberRounded';
import { StatCard } from './StatCard';

const meta = {
  title: 'Components/StatCard',
  component: StatCard,
  args: {
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
