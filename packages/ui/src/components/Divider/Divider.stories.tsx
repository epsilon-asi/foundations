import type { Meta, StoryObj } from '@storybook/react-vite';
import { Divider } from './Divider';

import { narrowConversation, longLabel } from '../../../.storybook/conversationExamples';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';

const meta = {
  title: 'Components/Divider',
  component: Divider,
  args: { label: 'Today' },
  play: checkStoryLayout
} satisfies Meta<typeof Divider>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Decorative: Story = { args: { label: undefined } };
export const Inset: Story = { args: { inset: true } };
export const Vertical: Story = { args: { orientation: 'vertical', label: undefined, sx: { height: 80 } } };
export const LongContent: Story = { args: { label: longLabel } };
export const Narrow: Story = { decorators: [narrowConversation], args: { label: longLabel } };
export const Dark: Story = { decorators: [withDarkUi] };
