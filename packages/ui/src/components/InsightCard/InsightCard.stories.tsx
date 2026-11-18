import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Typography } from '@mui/material';
import { AutoAwesome, MoreHoriz } from '@mui/icons-material';
import { expect, userEvent, within, fn } from 'storybook/test';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { ActionButton } from '../ActionButton';
import { IconMenu } from '../IconMenu';
import { InsightCard } from './InsightCard';

const meta = { title: 'Components/InsightCard', component: InsightCard, play: checkStoryLayout,
  args: { title: 'Your creative week', icon: <AutoAwesome />, children: <Typography>12 assets completed. Your team is making steady progress.</Typography> },
  decorators: [(Story) => <Box sx={{ maxWidth: 560 }}><Story /></Box>]
} satisfies Meta<typeof InsightCard>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Soft: Story = { args: { emphasis: 'soft' } };
export const Tones: Story = { render: (args) => <Box sx={{ display: 'grid', gap: 2 }}>{(['primary', 'secondary', 'info', 'success', 'warning', 'error'] as const).map((tone) =>
  <Box key={tone} sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: 1 }}>
    <InsightCard {...args} title={`${tone} · Solid`} tone={tone} /><InsightCard {...args} title={`${tone} · Soft`} tone={tone} emphasis="soft" />
  </Box>)}</Box> };
export const WithActions: Story = { args: {
  headerAction: <IconMenu aria-label="Insight options" icon={<MoreHoriz />} color="inherit" items={[{ id: 'share', label: 'Share insight', onClick: fn() }]} />,
  actions: <><ActionButton color="inherit" onClick={fn()}>Review assets</ActionButton><ActionButton variant="text" color="inherit">Dismiss</ActionButton></>
} };
export const Plain: Story = { args: { graphic: null, icon: null, emphasis: 'soft' } };
export const CustomGraphic: Story = { args: { graphic: <Typography aria-hidden sx={{ fontSize: 180, opacity: 0.15 }}>✦</Typography>, graphicSx: { right: 16, left: 'auto' } } };
export const LongContent: Story = { args: { title: 'A detailed creative activity report for the entire design and production team',
  children: 'asset_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz',
  actions: <ActionButton color="inherit">Review all completed project assets</ActionButton> } };
export const Dark: Story = { decorators: [withDarkUi] };
const onReview = fn();
export const ActionInteraction: Story = { args: { actions: <ActionButton onClick={onReview} color="inherit">Review</ActionButton> },
  play: async ({ canvasElement }) => { await userEvent.click(within(canvasElement).getByRole('button', { name: 'Review' })); await expect(onReview).toHaveBeenCalled(); await checkStoryLayout({ canvasElement }); } };
