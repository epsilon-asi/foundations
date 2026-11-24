import type { Meta, StoryObj } from '@storybook/react-vite';
import { CommandPalette } from './CommandPalette';

import { narrowConversation, longLabel, commands } from '../../../.storybook/conversationExamples';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { checkOverlayLayout } from '../../../.storybook/overlayExamples';
import { expect, userEvent, within } from 'storybook/test';
const meta = {
  title: 'Components/CommandPalette',
  component: CommandPalette,
  args: { open: true, items: commands, onClose: () => {}, onSelect: () => {} },
  play: checkOverlayLayout
} satisfies Meta<typeof CommandPalette>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Loading: Story = { args: { loading: true } };
export const Empty: Story = { args: { defaultQuery: 'missing' } };
export const Closed: Story = { args: { open: false } };
export const LongContent: Story = { args: { items: [{ id: 'long', title: longLabel, subtitle: longLabel }] } };
export const Narrow: Story = {
  decorators: [narrowConversation],
  args: { items: [{ id: 'long', title: longLabel, subtitle: longLabel }] }
};
export const Dark: Story = { decorators: [withDarkUi] };
export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = within(canvasElement.ownerDocument.body).getByRole('combobox');
    await userEvent.type(input, 'archive');
    await expect(within(canvasElement.ownerDocument.body).getByRole('option')).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    await checkOverlayLayout({ canvasElement });
  }
};
