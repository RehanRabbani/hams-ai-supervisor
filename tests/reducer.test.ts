import { describe, expect, it } from 'vitest';
import type { Conversation, Message, StreamEvent } from '../src/api/types';
import {
  addPendingMessage,
  applyEvent,
  confirmMessage,
  discardMessage,
  initialLiveState,
  seedConversations,
  seedThread,
  selectConversation,
  setMessageDelivery,
  type LiveState,
} from '../src/live/reducer';

// ---- Test helpers ------------------------------------------------------------------------

function conversation(id: string, overrides: Partial<Conversation> = {}): Conversation {
  return {
    id,
    customer: `Customer ${id}`,
    status: 'ai',
    lastMessage: '',
    unread: 0,
    updatedAt: '2026-11-25T00:00:00.000Z',
    ...overrides,
  };
}

function message(id: string, overrides: Partial<Message> = {}): Message {
  return {
    id,
    conversationId: 'c-1',
    role: 'customer',
    text: 'Hello',
    createdAt: '2026-11-25T00:00:00.000Z',
    ...overrides,
  };
}

function seededState(lastEventId = 0): LiveState {
  return seedConversations(initialLiveState, [conversation('c-1'), conversation('c-2')], lastEventId);
}

function openThread(state: LiveState, conversationId: string, messages: Message[] = []): LiveState {
  return seedThread(selectConversation(state, conversationId), conversationId, messages, state.cursor);
}

function applyAll(state: LiveState, events: StreamEvent[]): LiveState {
  return events.reduce(applyEvent, state);
}

// message_start, one token per word, message_end, with consecutive ids starting at firstId.
function aiReply(firstId: number, conversationId: string, messageId: string, words: string[]): StreamEvent[] {
  const tokens: StreamEvent[] = words.map((word, index) => ({
    id: firstId + 1 + index,
    type: 'token',
    conversationId,
    messageId,
    text: index === 0 ? word : ` ${word}`,
  }));
  return [
    { id: firstId, type: 'message_start', conversationId, messageId, role: 'ai' },
    ...tokens,
    { id: firstId + words.length + 1, type: 'message_end', conversationId, messageId },
  ];
}

function threadItems(state: LiveState, conversationId: string) {
  const thread = state.threads[conversationId];
  return thread.itemIds.map((id) => thread.itemsById[id]);
}

function threadMessage(state: LiveState, conversationId: string, itemId: string) {
  const item = state.threads[conversationId].itemsById[itemId];
  if (item.kind !== 'message') throw new Error(`${itemId} is not a message`);
  return item;
}

// ---- Tests -------------------------------------------------------------------------------

describe('event reducer', () => {
  it('1. builds a streamed AI reply from tokens in order', () => {
    const state = applyAll(
      openThread(seededState(), 'c-1'),
      aiReply(1, 'c-1', 'm-9', ['Your', 'order', 'has', 'shipped']),
    );

    const item = threadMessage(state, 'c-1', 'm-9');
    expect(item.message.text).toBe('Your order has shipped');
    expect(item.message.streaming).toBeUndefined();
    expect(state.cursor).toBe(6);
  });

  it('2. ignores events replayed after a reconnect', () => {
    const events = aiReply(1, 'c-1', 'm-9', ['Refund', 'approved', 'for', '149', 'SAR', 'on', 'your', 'card']);
    const beforeDrop = applyAll(openThread(seededState(), 'c-1'), events.slice(0, 6));

    // The mock replays from `since - 3`: events 4, 5 and 6 arrive a second time.
    const afterResume = applyAll(beforeDrop, events.slice(3));

    expect(threadMessage(afterResume, 'c-1', 'm-9').message.text).toBe('Refund approved for 149 SAR on your card');
    expect(threadItems(afterResume, 'c-1')).toHaveLength(1);
    expect(afterResume.cursor).toBe(10);
  });

  it('3. flags a resync when an event is missing', () => {
    const state = applyEvent(seededState(10), { id: 12, type: 'status', conversationId: 'c-1', status: 'closed' });

    expect(state.needsResync).toBe(true);
    expect(state.cursor).toBe(10);
    expect(state.conversations['c-1'].status).toBe('ai');
  });

  it('4. shows the hand-off reason and marks the conversation as needing a human', () => {
    const state = applyAll(openThread(seededState(), 'c-1'), [
      {
        id: 1,
        type: 'tool_call',
        conversationId: 'c-1',
        name: 'transfer_to_human',
        args: { reason: 'Billing dispute needs a supervisor' },
      },
      { id: 2, type: 'status', conversationId: 'c-1', status: 'needs_human' },
    ]);

    expect(threadItems(state, 'c-1')).toEqual([
      { kind: 'handoff', id: 'handoff-1', reason: 'Billing dispute needs a supervisor' },
    ]);
    expect(state.conversations['c-1'].status).toBe('needs_human');
    expect(state.conversations['c-1'].handoffReason).toBe('Billing dispute needs a supervisor');
  });

  it('5. merges a snapshot with events that arrived while it was loading', () => {
    const events = aiReply(18, 'c-1', 'm-50', ['Your', 'order', 'has', 'shipped']); // ids 18 to 23
    let state = selectConversation(seededState(17), 'c-1');
    expect(state.threads['c-1'].listeningFrom).toBe(17);
    state = applyAll(state, events.slice(0, 5)); // ids 18 to 22 are buffered

    // The snapshot was taken at event 20, so it already holds "Your order".
    state = seedThread(state, 'c-1', [message('m-50', { role: 'ai', text: 'Your order', streaming: true })], 20);
    state = applyEvent(state, events[5]); // message_end, id 23

    const item = threadMessage(state, 'c-1', 'm-50');
    expect(item.message.text).toBe('Your order has shipped');
    expect(item.message.streaming).toBeUndefined();

    // A second, older snapshot for a thread that is already live changes nothing.
    const again = seedThread(state, 'c-1', [message('m-50', { role: 'ai', text: 'Your order', streaming: true })], 20);
    expect(again).toBe(state);
  });

  it('6. shows a sent reply once, whether the SSE echo or the 201 arrives first', () => {
    let state = openThread(seededState(), 'c-1');
    state = addPendingMessage(state, 'c-1', 'tmp-1', 'Hi Omar');
    expect(threadMessage(state, 'c-1', 'tmp-1').delivery).toBe('pending');

    const saved = message('m-77', { role: 'human', text: 'Hi Omar', clientMessageId: 'tmp-1' });
    state = applyEvent(state, { id: 1, type: 'message', conversationId: 'c-1', message: saved });
    state = confirmMessage(state, 'c-1', saved);

    expect(threadItems(state, 'c-1')).toHaveLength(1);
    const item = threadMessage(state, 'c-1', 'tmp-1');
    expect(item.delivery).toBe('sent');
    expect(item.message.id).toBe('m-77');
  });

  it('7. rolls back a rejected reply, then lets it be retried or discarded', () => {
    let state = openThread(seededState(), 'c-1');
    state = addPendingMessage(state, 'c-1', 'tmp-1', 'I will refund you today');
    state = setMessageDelivery(state, 'c-1', 'tmp-1', 'failed', 'Random failure, please retry');

    expect(threadMessage(state, 'c-1', 'tmp-1')).toMatchObject({
      delivery: 'failed',
      error: 'Random failure, please retry',
    });

    const retried = setMessageDelivery(state, 'c-1', 'tmp-1', 'pending');
    const confirmed = confirmMessage(
      retried,
      'c-1',
      message('m-80', { role: 'human', text: 'I will refund you today', clientMessageId: 'tmp-1' }),
    );
    expect(threadMessage(confirmed, 'c-1', 'tmp-1').delivery).toBe('sent');
    expect(threadMessage(confirmed, 'c-1', 'tmp-1').error).toBeUndefined();

    const discarded = discardMessage(state, 'c-1', 'tmp-1');
    expect(threadItems(discarded, 'c-1')).toHaveLength(0);
  });

  it('8. counts unread customer messages only for conversations that are not open', () => {
    const state = applyAll(selectConversation(seededState(), 'c-1'), [
      { id: 1, type: 'message', conversationId: 'c-2', message: message('m-1', { conversationId: 'c-2' }) },
      { id: 2, type: 'message', conversationId: 'c-1', message: message('m-2') },
      {
        id: 3,
        type: 'message',
        conversationId: 'c-2',
        message: message('m-3', { conversationId: 'c-2', role: 'human' }),
      },
    ]);

    expect(state.conversations['c-2'].unread).toBe(1);
    expect(state.conversations['c-1'].unread).toBe(0);
  });

  it('9. updates the list from tokens for a conversation that was never opened', () => {
    const events = aiReply(1, 'c-2', 'm-60', ['Refund', 'approved', 'today']);

    const whileStreaming = applyAll(seededState(), events.slice(0, 3));
    expect(whileStreaming.conversations['c-2'].streamingMessageId).toBe('m-60');

    const done = applyAll(whileStreaming, events.slice(3));
    expect(done.conversations['c-2'].lastMessage).toBe('Refund approved today');
    expect(done.conversations['c-2'].streamingMessageId).toBeNull();
    expect(done.order[0]).toBe('c-2');
    expect(done.threads['c-2']).toBeUndefined();
  });

  it('10. keeps the hand-off card when the mock gives the conversation back to the AI', () => {
    const state = applyAll(openThread(seededState(), 'c-1'), [
      {
        id: 1,
        type: 'tool_call',
        conversationId: 'c-1',
        name: 'transfer_to_human',
        args: { reason: 'Customer asked to speak to a person' },
      },
      { id: 2, type: 'status', conversationId: 'c-1', status: 'needs_human' },
      { id: 3, type: 'status', conversationId: 'c-1', status: 'ai' },
    ]);

    expect(state.conversations['c-1'].status).toBe('ai');
    expect(threadItems(state, 'c-1')).toHaveLength(1);
    expect(threadItems(state, 'c-1')[0].kind).toBe('handoff');
  });

  it('11. flags a resync when the server restarts and its event ids start again', () => {
    const state = applyEvent(seededState(500), { id: 2, type: 'status', conversationId: 'c-1', status: 'needs_human' });

    expect(state.needsResync).toBe(true);
    expect(state.conversations['c-1'].status).toBe('ai');
  });
});
