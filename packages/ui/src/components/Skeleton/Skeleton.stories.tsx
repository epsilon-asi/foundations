import type { Meta, StoryObj } from '@storybook/react-vite';
import { Skeleton } from './Skeleton';

import { narrowConversation } from '../../../.storybook/conversationExamples';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';

const meta = {
  title: 'Components/Skeleton',
  component: Skeleton,
  args: { width: '75%' },
  play: checkStoryLayout
} satisfies Meta<typeof Skeleton>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Rect: Story = { args: { variant: 'rect', height: 60 } };
export const Circle: Story = { args: { variant: 'circle', width: 28, height: 28 } };
export const LongContent: Story = { args: { lines: 6, width: '100%' } };
export const Narrow: Story = { decorators: [narrowConversation], args: { lines: 6, width: '100%' } };
export const Dark: Story = { decorators: [withDarkUi] };
