import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { narrowConversation } from '../../../.storybook/conversationExamples';
import {
  Stack,
  Text,
  Message,
  MessageList,
  MessageComposer,
  Panel,
  ActivityItem,
  DecisionCard,
  Tag,
  Avatar,
  SearchField
} from '../../index';
import { Markdown } from '../Markdown';
import { DiffView } from '../DiffView';
function Conversation() {
  const [messages, setMessages] = React.useState<string[]>(['Review the draft.', 'The revision is ready.']);
  const [resolved, setResolved] = React.useState(false),
    [query, setQuery] = React.useState('');
  return (
    <Stack sx={{ maxWidth: 860 }}>
      <Panel title="Document review" headerAction={<Tag label="Draft" color="iris" />}>
        <SearchField aria-label="Find a message" value={query} onChange={setQuery} placeholder="Find a message" />
      </Panel>
      <MessageList
        aria-label="Conversation"
        items={messages
          .map((body, i) => ({ id: String(i), body }))
          .filter((m) => m.body.toLowerCase().includes(query.toLowerCase()))}
        getItemKey={(m) => m.id}
        sx={{ height: 360 }}
        renderItem={(m) => (
          <Message
            role={m.id === '1' ? 'assistant' : 'user'}
            author={m.id === '1' ? 'Editor' : 'Avery'}
            avatar={<Avatar size="xs" name={m.id === '1' ? 'Editor' : 'Avery'} />}
          >
            <Markdown content={m.body} />
            {m.id === '1' && (
              <>
                <ActivityItem title="Compare revisions" status="success">
                  <DiffView oldValue="Draft" newValue="Ready" filename="notes.txt" />
                </ActivityItem>
                <DecisionCard
                  title="Save the revision?"
                  actions={[{ id: 'save', label: 'Save', kind: 'primary' }]}
                  onDecision={() => setResolved(true)}
                  resolution={resolved ? { actionId: 'save', label: 'Revision saved' } : undefined}
                />
              </>
            )}
          </Message>
        )}
      />
      <MessageComposer aria-label="Write a message" onSubmit={(text) => setMessages((v) => [...v, text])} />
    </Stack>
  );
}
const meta = {
  title: 'Patterns/Conversation',
  component: Conversation,
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(within(canvasElement).getByText('The revision is ready.')).toBeVisible());
    await checkStoryLayout({ canvasElement });
  }
} satisfies Meta<typeof Conversation>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Narrow: Story = { decorators: [narrowConversation] };
export const Dark: Story = { decorators: [withDarkUi] };
export const Send: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const draft = canvas.getByRole('textbox', { name: 'Write a message' });
    await userEvent.type(draft, 'Looks ready.{Enter}');
    await waitFor(() => expect(canvas.getByText('Looks ready.')).toBeVisible());
    await checkStoryLayout({ canvasElement });
  }
};
