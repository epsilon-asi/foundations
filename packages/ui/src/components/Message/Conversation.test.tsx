import * as React from 'react';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { VirtuosoMockContext } from 'react-virtuoso';
import { renderWithUi } from '../../test/renderWithUi';
import { Message } from './Message';
import { MessageList, type MessageListHandle } from '../MessageList';
import { ActivityGroup, ActivityItem } from '../ActivityItem';
import { DecisionCard } from '../DecisionCard';
import { QuestionCard } from '../QuestionCard';
it('names the article with author and time and exposes retry and footer actions', () => {
  const retry = vi.fn();
  renderWithUi(
    <Message
      role="user"
      author="Avery"
      timestamp={0}
      status="error"
      error="Paused"
      onRetry={retry}
      footer="Saved locally"
    >
      Hello
    </Message>
  );
  expect(screen.getByRole('article', { name: /Avery.*1970/ })).toHaveTextContent('Hello');
  expect(screen.getByRole('alert')).toHaveTextContent('Paused');
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(retry).toHaveBeenCalledOnce();
});
it('renders a bounded transcript window and exposes keyboard scrolling and an imperative handle', async () => {
  const items = Array.from({ length: 4000 }, (_, i) => String(i)),
    ref = React.createRef<MessageListHandle>();
  renderWithUi(
    <VirtuosoMockContext.Provider value={{ viewportHeight: 200, itemHeight: 40 }}>
      <MessageList
        aria-label="Transcript"
        items={items}
        getItemKey={(i) => i}
        renderItem={(item, state) => <span data-row={state.index}>{item}</span>}
        ref={ref}
        followOutput={false}
      />
    </VirtuosoMockContext.Provider>
  );
  await waitFor(() => expect(screen.getByRole('log').querySelectorAll('[data-row]').length).toBeGreaterThan(0));
  const log = screen.getByRole('log', { name: 'Transcript' });
  expect(log).toHaveAttribute('tabindex', '0');
  await waitFor(() => expect(log.querySelectorAll('[data-row]').length).toBeGreaterThan(0));
  expect(log.querySelectorAll('[data-row]').length).toBeLessThan(100);
  act(() => {
    ref.current?.scrollToItem('missing');
  });
  expect(() => fireEvent.keyDown(log, { key: 'Home' })).not.toThrow();
});
it('links disclosures, reports controlled requests and keeps child actions independent', () => {
  const toggle = vi.fn();
  const { rerender } = renderWithUi(
    <ActivityItem title="Review" status="success" expanded={false} onExpandedChange={toggle}>
      Detail
    </ActivityItem>
  );
  const button = screen.getByRole('button', { name: 'Review' });
  fireEvent.click(button);
  expect(toggle).toHaveBeenCalledWith(true);
  expect(button).toHaveAttribute('aria-expanded', 'false');
  rerender(
    <ActivityGroup label="Two steps" defaultExpanded>
      <ActivityItem title="Review" defaultExpanded>
        Detail
      </ActivityItem>
    </ActivityGroup>
  );
  expect(screen.getByRole('region', { name: 'Two steps' })).toContainElement(
    screen.getByRole('region', { name: 'Review' })
  );
});
it('puts the primary action first, collects a required reason and guards pending decisions', async () => {
  let reject!: (e: Error) => void;
  const decide = vi.fn(
    () =>
      new Promise<void>((_, r) => {
        reject = r;
      })
  );
  const actions = [
    { id: 'change', label: 'Change', collectReason: { label: 'Reason', required: true } },
    { id: 'save', label: 'Save', kind: 'primary' as const }
  ];
  const { rerender } = renderWithUi(<DecisionCard title="Save changes?" actions={actions} onDecision={decide} />);
  expect(within(screen.getByRole('group', { name: 'Save changes?' })).getAllByRole('button')[0]).toHaveTextContent(
    'Save'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Change' }));
  expect(screen.getByRole('button', { name: 'Change' })).toBeDisabled();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: ' Missing label ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Change' }));
  expect(decide).toHaveBeenCalledWith('change', { reason: 'Missing label' });
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  await act(async () => reject(new Error('Try later')));
  expect(screen.getByRole('alert')).toHaveTextContent('Try later');
  expect(screen.getByRole('button', { name: 'Change' })).toBeEnabled();
  rerender(
    <DecisionCard
      title="Save changes?"
      resolution={{ actionId: 'save', label: 'Saved' }}
      actions={actions}
      onDecision={decide}
    >
      Original detail
    </DecisionCard>
  );
  const saved = screen.getByRole('button', { name: 'Saved' });
  expect(saved).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(saved);
  expect(screen.getByText('Original detail')).toBeVisible();
});
it('validates each question and returns other text and multiple selections as data', async () => {
  const submit = vi.fn();
  const questions = [
    { id: 'kind', question: 'Choose a kind', options: [{ label: 'Plain' }], allowOther: { label: 'Custom' } },
    { id: 'parts', question: 'Include parts', options: [{ label: 'Title' }, { label: 'Body' }], multiSelect: true }
  ];
  const { rerender } = renderWithUi(<QuestionCard questions={questions} onSubmit={submit} />);
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
  expect(screen.getAllByRole('alert')).toHaveLength(2);
  fireEvent.click(screen.getByRole('radio', { name: 'Custom' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Custom' }), { target: { value: 'Table' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Title' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Body' }));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Submit' })));
  expect(submit).toHaveBeenCalledWith({ kind: 'Table', parts: ['Title', 'Body'] });
  rerender(
    <QuestionCard
      questions={questions}
      onSubmit={submit}
      resolution={{ answers: { kind: 'Table', parts: ['Title', 'Body'] } }}
    />
  );
  expect(screen.queryByRole('radio')).toBeNull();
  expect(screen.getByText('Title, Body')).toBeVisible();
});
