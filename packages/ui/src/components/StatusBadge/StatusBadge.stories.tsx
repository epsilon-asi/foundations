import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Typography } from '@mui/material';
import { expect, userEvent, within } from 'storybook/test';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { StatusBadge } from './StatusBadge';

const meta = { title: 'Components/StatusBadge', component: StatusBadge, play: checkStoryLayout, args: { label: 'Ready', tone: 'success' } } satisfies Meta<typeof StatusBadge>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const AllTonesAndVariants: Story = { render: () => <Box sx={{ display: 'grid', gap: 2 }}>{(['neutral', 'info', 'success', 'warning', 'error'] as const).map((tone) =>
  <Box key={tone} sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}><Typography sx={{ width: 64, maxWidth: '100%' }}>{tone}</Typography>{(['soft', 'outlined', 'solid'] as const).map((variant) =>
    <StatusBadge key={variant} label={variant} tone={tone} variant={variant} />)}<StatusBadge label={tone} tone={tone} display="dot" /></Box>)}</Box> };
export const Sizes: Story = { render: (args) => <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}><StatusBadge {...args} /><StatusBadge {...args} size="medium" /><StatusBadge {...args} display="dot" /><StatusBadge {...args} display="dot" size="medium" /></Box> };
export const WithoutIndicator: Story = { args: { indicator: false } };
export const Pulse: Story = { args: { label: 'Processing', tone: 'info', pulse: true } };
export const DotOnly: Story = { args: { label: 'Processing', display: 'dot', pulse: true, tone: 'info' } };
export const LongLabel: Story = { args: { label: 'Awaiting review from the production and compliance teams', tone: 'warning', sx: { maxWidth: 240 } } };
export const Dark: Story = { ...AllTonesAndVariants, decorators: [withDarkUi] };
export const KeyboardTooltip: Story = { args: { label: 'Processing', display: 'dot', tone: 'info' }, play: async ({ canvasElement }) => {
  const dot = within(canvasElement).getByRole('img', { name: 'Processing' }); dot.focus();
  await expect(dot).toHaveFocus(); await expect(await within(canvasElement.ownerDocument.body).findByRole('tooltip')).toHaveTextContent('Processing');
  await userEvent.tab(); await checkStoryLayout({ canvasElement });
} };
