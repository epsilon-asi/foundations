import type { Meta, StoryObj } from '@storybook/react-vite';
import { Meter } from './Meter';

import { narrowConversation, longLabel } from '../../../.storybook/conversationExamples';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';

const meta = {
  title: 'Components/Meter',
  component: Meter,
  args: { label: 'Capacity', value: 42 },
  play: checkStoryLayout
} satisfies Meta<typeof Meter>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Elevated: Story = { args: { value: 80 } };
export const High: Story = { args: { value: 98 } };
export const Stacked: Story = { args: { layout: 'stacked', size: 'xs' } };
export const Explicit: Story = { args: { tone: 'info', showValue: false } };
export const LongContent: Story = { args: { label: longLabel, value: 92 } };
export const Narrow: Story = { decorators: [narrowConversation], args: { label: longLabel, value: 92 } };
export const Dark: Story = { decorators: [withDarkUi] };
