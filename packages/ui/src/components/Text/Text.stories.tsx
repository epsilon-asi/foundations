import type { Meta, StoryObj } from '@storybook/react-vite';
import { Text } from './Text';

import { narrowConversation, longLabel } from '../../../.storybook/conversationExamples';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';

const meta = {
  title: 'Components/Text',
  component: Text,
  args: { children: 'Document title' },
  play: checkStoryLayout
} satisfies Meta<typeof Text>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const BodySmall: Story = { args: { variant: 'bodySmall' } };
export const Caption: Story = { args: { variant: 'caption' } };
export const Label: Story = { args: { variant: 'label' } };
export const Code: Story = { args: { variant: 'code' } };
export const Title: Story = { args: { variant: 'title' } };
export const Subtitle: Story = { args: { variant: 'subtitle' } };
export const Secondary: Story = { args: { tone: 'secondary' } };
export const Muted: Story = { args: { tone: 'muted' } };
export const Success: Story = { args: { tone: 'success' } };
export const Warning: Story = { args: { tone: 'warning' } };
export const Error: Story = { args: { tone: 'error' } };
export const Info: Story = { args: { tone: 'info' } };
export const LongContent: Story = { args: { children: longLabel, truncate: 2, sx: { maxWidth: 180 } } };
export const Narrow: Story = {
  decorators: [narrowConversation],
  args: { children: longLabel, truncate: 2, sx: { maxWidth: 180 } }
};
export const Dark: Story = { decorators: [withDarkUi] };
