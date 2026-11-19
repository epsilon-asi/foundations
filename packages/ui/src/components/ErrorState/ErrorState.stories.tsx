import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '@mui/material';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { ActionButton } from '../ActionButton';
import { ErrorState } from './ErrorState';

const meta = { title: 'Components/ErrorState', component: ErrorState, play: checkStoryLayout,
  args: { title: 'Unable to load assets', description: 'Check your connection and try again.', onRetry: async () => {} } } satisfies Meta<typeof ErrorState>;
export default meta; type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Retrying: Story = { args: { retrying: true } };
export const DisabledRetry: Story = { args: { retryDisabled: true } };
export const WithoutRetry: Story = { args: { onRetry: undefined, description: 'You do not have access to this collection.' } };
export const Details: Story = { args: { details: 'Request could not reach the selected destination.\nError code: EXPORT_DESTINATION_UNAVAILABLE' } };
export const AdditionalAction: Story = { args: { actions: <ActionButton href="#destination">Choose destination</ActionButton> } };
export const Comfortable: Story = { args: { compact: false } };
export const LongContent: Story = { args: { title: 'The complete selected character and environment collection could not be exported', description: 'asset_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz', details: 'export_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz' } };
export const Narrow: Story = { decorators: [Story => <Box sx={{ width: 240, maxWidth: '100%' }}><Story /></Box>] };
export const Dark: Story = { decorators: [withDarkUi] };
export const RetryFailure: Story = { args: { onRetry: async () => { throw new Error('Simulated retry failure'); } }, play: async ({ canvasElement }) => { const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: 'Try again' })); await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent('Retry failed'));
  await checkStoryLayout({ canvasElement }); } };
export const KeyboardDetails: Story = { args: Details.args, play: async ({ canvasElement }) => { const canvas = within(canvasElement); canvas.getByRole('button', { name: 'Error details' }).focus();
  await userEvent.keyboard('{Enter}'); await expect(canvas.getByText(/Error code:/)).toBeVisible(); await checkStoryLayout({ canvasElement }); } };
