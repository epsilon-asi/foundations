import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '@mui/material';
import { expect, userEvent, within, fn } from 'storybook/test';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { controlContainer } from '../../../.storybook/controlExamples';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { ActionButton } from '../ActionButton';
import { Alert } from './Alert';
const closed = fn();
const meta = { title: 'Components/Alert', component: Alert, play: checkStoryLayout,
  args: { title: 'Asset saved', children: 'Your changes are available to the creative team.' }, decorators: [controlContainer]
} satisfies Meta<typeof Alert>;
export default meta; type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Severities: Story = { render: (args) => <Box sx={{ display: 'grid', gap: 2 }}>{(['info', 'success', 'warning', 'error'] as const).map((severity) => <Alert {...args} key={severity} title={severity} severity={severity} />)}</Box> };
export const Variants: Story = { render: (args) => <Box sx={{ display: 'grid', gap: 2 }}>{(['standard', 'outlined', 'filled'] as const).map((variant) => <Alert {...args} key={variant} variant={variant} severity="warning" />)}</Box> };
export const WithActions: Story = { args: { title: 'Could not save', severity: 'error', children: 'Try saving this revision again.', action: <ActionButton color="inherit" onClick={fn()}>Retry</ActionButton>, onClose: closed } };
export const LongContent: Story = { args: { title: 'Some production assets need additional review before they can be published', severity: 'warning', children: 'asset_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz', action: <ActionButton color="inherit">Review all pending changes</ActionButton>, onClose: closed } };
export const Dark: Story = { ...Severities, decorators: [withDarkUi] };
export const Dismissal: Story = { args: { onClose: closed }, play: async ({ canvasElement }) => {
  await userEvent.click(within(canvasElement).getByRole('button', { name: 'Close alert' })); await expect(closed).toHaveBeenCalled(); await checkStoryLayout({ canvasElement });
} };
