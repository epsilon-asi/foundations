import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar } from './Avatar';

import { narrowConversation, longLabel } from '../../../.storybook/conversationExamples';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';

const meta = {
  title: 'Components/Avatar',
  component: Avatar,
  args: { name: 'Avery Lane' },
  play: checkStoryLayout
} satisfies Meta<typeof Avatar>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const ExtraSmall: Story = { args: { size: 'xs' } };
export const Medium: Story = { args: { size: 'md', color: 'jade' } };
export const Icon: Story = { args: { name: 'Team', icon: '◇' } };
export const Fallback: Story = { args: { src: 'data:image/png;base64,invalid' } };
export const LongContent: Story = { args: { name: longLabel } };
export const Narrow: Story = { decorators: [narrowConversation], args: { name: longLabel } };
export const Dark: Story = { decorators: [withDarkUi] };
