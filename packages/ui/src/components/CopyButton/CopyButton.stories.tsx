import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { simulateCopy, rejectCopy } from '../../../.storybook/collectionExamples';
import { CopyButton } from './CopyButton';

const meta = { title: 'Components/CopyButton', component: CopyButton, play: checkStoryLayout,
  args: { value: 'asset_123456789', copy: simulateCopy, resetAfter: 0 } } satisfies Meta<typeof CopyButton>;
export default meta; type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Disabled: Story = { args: { disabled: true } };
export const CustomLabels: Story = { args: { 'aria-label': 'Copy asset identifier', copiedLabel: 'Identifier copied', errorLabel: 'Copy failed' } };
export const BrowserClipboard: Story = { args: { copy: undefined }, parameters: { docs: { description: { story: 'Uses the browser clipboard when clicked. Other stories simulate clipboard results.' } } } };
export const Copied: Story = { play: async ({ canvasElement }) => { const canvas = within(canvasElement); await userEvent.click(canvas.getByRole('button', { name: 'Copy value' }));
  await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent('Copied')); await checkStoryLayout({ canvasElement }); } };
export const Failed: Story = { args: { copy: rejectCopy }, play: async ({ canvasElement }) => { const canvas = within(canvasElement); await userEvent.click(canvas.getByRole('button'));
  await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent('Unable to copy')); await checkStoryLayout({ canvasElement }); } };
export const Pending: Story = { args: { copy: () => new Promise<void>(() => {}) }, play: async ({ canvasElement }) => { const canvas = within(canvasElement); await userEvent.click(canvas.getByRole('button'));
  await expect(canvas.getByRole('button')).toHaveAttribute('aria-busy', 'true'); await checkStoryLayout({ canvasElement }); } };
export const Keyboard: Story = { play: async ({ canvasElement }) => { const canvas = within(canvasElement); canvas.getByRole('button').focus(); await userEvent.keyboard('{Enter}');
  await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent('Copied')); await expect(canvas.getByRole('button')).toHaveFocus(); await checkStoryLayout({ canvasElement }); } };
export const Dark: Story = { decorators: [withDarkUi] };
