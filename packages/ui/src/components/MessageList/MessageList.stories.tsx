import * as React from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { ActionButton } from '../ActionButton';
import { Stack } from '../Stack';
import type { MessageListHandle } from './MessageList';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MessageList } from './MessageList';
import { Text } from '../Text';
import { narrowConversation, sampleMessages, getMessageKey } from '../../../.storybook/conversationExamples';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';

const meta = {
  title: 'Components/MessageList',
  component: MessageList<(typeof sampleMessages)[number]>,
  args: {
    'aria-label': 'History',
    items: sampleMessages.slice(0, 8),
    getItemKey: getMessageKey,
    renderItem: (item) => <Text>{item.text}</Text>
  },
  play: async ({ canvasElement, args }) => {
    if (args.items.length)
      await waitFor(() => expect(canvasElement.querySelector('[data-item-index]')).not.toBeNull());
    await checkStoryLayout({ canvasElement });
  }
} satisfies Meta<typeof MessageList<(typeof sampleMessages)[number]>>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const LoadingOlder: Story = { args: { loadingOlder: true } };
export const Manual: Story = { args: { followOutput: false, unseenCount: 3 } };
export const Always: Story = { args: { followOutput: 'always' } };
export const Empty: Story = { args: { items: [] } };
export const LongContent: Story = { args: { items: sampleMessages } };
export const Narrow: Story = { decorators: [narrowConversation], args: { items: sampleMessages } };
export const Dark: Story = { decorators: [withDarkUi] };

function GrowingHistory() {
  const transcript = React.useRef<MessageListHandle>(null);
  const [items, setItems] = React.useState(sampleMessages.slice(100, 180));
  const grow = () =>
    setItems((current) =>
      current.map((item, index) =>
        index === current.length - 1 ? { ...item, text: item.text + ' More text.'.repeat(80) } : item
      )
    );
  return (
    <Stack>
      <Stack direction="row" wrap>
        <ActionButton onClick={grow}>Append text</ActionButton>
        <ActionButton onClick={() => transcript.current?.scrollToItem('130', { align: 'start', highlight: true })}>
          Find entry
        </ActionButton>
        <ActionButton onClick={() => setItems((current) => [...sampleMessages.slice(75, 100), ...current])}>
          Load earlier
        </ActionButton>
      </Stack>
      <MessageList
        aria-label="History"
        ref={transcript}
        items={items}
        getItemKey={getMessageKey}
        sx={{ height: 240 }}
        renderItem={(item, state) => (
          <Text as="div" data-entry={item.id} data-highlighted={state.highlighted}>
            {item.text}
          </Text>
        )}
      />
    </Stack>
  );
}
export const StreamingAndPrepending: Story = {
  render: () => <GrowingHistory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const log = await canvas.findByRole('log', { busy: false });
    const remaining = () => log.scrollHeight - log.scrollTop - log.clientHeight;
    await waitFor(() => expect(log.querySelector('[data-entry="179"]')).not.toBeNull());
    await userEvent.click(canvas.getByRole('button', { name: 'Append text' }));
    await waitFor(() => expect(remaining()).toBeLessThanOrEqual(2));
    await userEvent.click(canvas.getByRole('button', { name: 'Find entry' }));
    const target = () => log.querySelector<HTMLElement>('[data-entry="130"]');
    await waitFor(() => {
      expect(target()).toHaveAttribute('data-highlighted', 'true');
      expect(Math.abs(target()!.getBoundingClientRect().top - log.getBoundingClientRect().top)).toBeLessThan(3);
    });
    const y = target()!.getBoundingClientRect().top;
    await userEvent.click(canvas.getByRole('button', { name: 'Append text' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Load earlier' }));
    await waitFor(() => expect(Math.abs(target()!.getBoundingClientRect().top - y)).toBeLessThan(3));
    await userEvent.click(await canvas.findByRole('button', { name: 'Jump to latest' }));
    await waitFor(() => expect(remaining()).toBeLessThanOrEqual(2));
    await checkStoryLayout({ canvasElement });
  }
};
