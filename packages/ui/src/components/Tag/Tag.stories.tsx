import type { Meta, StoryObj } from '@storybook/react-vite';
import { Tag } from './Tag';

import { narrowConversation, longLabel } from '../../../.storybook/conversationExamples';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';

const meta = {
  title: 'Components/Tag',
  component: Tag,
  args: { label: 'Draft', color: 'plum' },
  play: checkStoryLayout
} satisfies Meta<typeof Tag>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Outlined: Story = { args: { variant: 'outlined' } };
export const Solid: Story = { args: { variant: 'solid', color: 'rebeccapurple' } };
export const ExtraSmall: Story = { args: { size: 'xs' } };
export const Interactive: Story = { args: { onClick: () => {}, onRemove: () => {}, icon: '◇' } };
export const LongContent: Story = { args: { label: longLabel, maxWidth: 140 } };
export const Narrow: Story = { decorators: [narrowConversation], args: { label: longLabel, maxWidth: 140 } };
export const Dark: Story = { decorators: [withDarkUi] };
