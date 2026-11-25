import type { Conversation, Message, Status, StreamEvent } from '../api/types';

// Pure functions only: every function takes the current state and returns a new one.
// The Zustand store calls these, and the unit tests call them directly.

export type Delivery = 'pending' | 'sent' | 'failed';

export type ThreadItem =
  | { kind: 'message'; id: string; message: Message; delivery?: Delivery; error?: string }
  | { kind: 'handoff'; id: string; reason: string };

export interface Thread {
  status: 'loading' | 'ready';
  listeningFrom: number;
  watermark: number;
  itemIds: string[];
  itemsById: Record<string, ThreadItem>;
  buffer: StreamEvent[];
}

export interface ConversationSummary extends Conversation {
  streamingMessageId: string | null;
  draft: string;
  handoffReason: string | null;
}

export interface LiveState {
  cursor: number;
  needsResync: boolean;
  selectedId: string | null;
  order: string[];
  conversations: Record<string, ConversationSummary>;
  threads: Record<string, Thread>;
}

// The mock replays from `since - 3` after a reconnect, so anything older than that means the server restarted.
const REPLAY_OVERLAP = 3;

export const initialLiveState: LiveState = {
  cursor: 0,
  needsResync: false,
  selectedId: null,
  order: [],
  conversations: {},
  threads: {},
};

// ---- Snapshots from the REST API --------------------------------------------------------

export function seedConversations(state: LiveState, conversations: Conversation[], lastEventId: number): LiveState {
  const summaries: Record<string, ConversationSummary> = {};
  for (const conversation of conversations) {
    summaries[conversation.id] = {
      ...conversation,
      unread: conversation.id === state.selectedId ? 0 : conversation.unread,
      streamingMessageId: null,
      draft: '',
      handoffReason: state.conversations[conversation.id]?.handoffReason ?? null,
    };
  }

  return {
    ...state,
    cursor: lastEventId,
    needsResync: false,
    order: conversations.map((conversation) => conversation.id),
    conversations: summaries,
    threads: {},
  };
}

export function selectConversation(state: LiveState, conversationId: string): LiveState {
  const summary = state.conversations[conversationId];
  if (!summary) return state;

  const threads = state.threads[conversationId]
    ? state.threads
    : { ...state.threads, [conversationId]: createLoadingThread(state.cursor) };

  return {
    ...state,
    selectedId: conversationId,
    conversations: { ...state.conversations, [conversationId]: { ...summary, unread: 0 } },
    threads,
  };
}

// Events that arrived while the messages were loading sit in `buffer`. The snapshot already
// contains everything up to `lastEventId`, so only newer buffered events are applied.
export function seedThread(
  state: LiveState,
  conversationId: string,
  messages: Message[],
  lastEventId: number,
): LiveState {
  const loadingThread = state.threads[conversationId];
  // A thread that is already live is newer than any snapshot. Filling it again would drop newer events and unsent replies.
  if (loadingThread?.status === 'ready') return state;
  const buffered = loadingThread?.buffer ?? [];

  let thread: Thread = {
    status: 'ready',
    listeningFrom: loadingThread?.listeningFrom ?? lastEventId,
    watermark: lastEventId,
    itemIds: messages.map((message) => message.id),
    itemsById: Object.fromEntries(messages.map((message) => [message.id, toItem(message)])),
    buffer: [],
  };
  for (const event of buffered) {
    thread = applyToThread(thread, event);
  }

  return { ...state, threads: { ...state.threads, [conversationId]: thread } };
}

// ---- Live events -------------------------------------------------------------------------

export function applyEvent(state: LiveState, event: StreamEvent): LiveState {
  if (state.needsResync) return state;

  if (event.id <= state.cursor) {
    const serverRestarted = event.id < state.cursor - REPLAY_OVERLAP;
    return serverRestarted ? { ...state, needsResync: true } : state;
  }

  if (event.id > state.cursor + 1) {
    return { ...state, needsResync: true };
  }

  const { conversationId } = event;
  const summary = state.conversations[conversationId];
  const thread = state.threads[conversationId];

  const conversations = summary
    ? { ...state.conversations, [conversationId]: updateSummary(summary, event, conversationId === state.selectedId) }
    : state.conversations;

  const movesToTop = event.type === 'message' || event.type === 'message_end' || event.type === 'status';
  const order = movesToTop ? moveToTop(state.order, conversationId) : state.order;

  let threads = state.threads;
  if (thread) {
    const nextThread =
      thread.status === 'loading' ? { ...thread, buffer: [...thread.buffer, event] } : applyToThread(thread, event);
    threads = { ...state.threads, [conversationId]: nextThread };
  }

  return { ...state, cursor: event.id, conversations, order, threads };
}

function updateSummary(summary: ConversationSummary, event: StreamEvent, isSelected: boolean): ConversationSummary {
  switch (event.type) {
    case 'message': {
      const countsAsUnread = event.message.role === 'customer' && !isSelected;
      return {
        ...summary,
        lastMessage: event.message.text,
        updatedAt: event.message.createdAt,
        unread: countsAsUnread ? summary.unread + 1 : summary.unread,
      };
    }
    case 'message_start':
      return { ...summary, streamingMessageId: event.messageId, draft: '' };
    case 'token':
      // AI replies never get a `message` event, so the list builds the final text from tokens itself.
      return event.messageId === summary.streamingMessageId
        ? { ...summary, draft: summary.draft + event.text }
        : summary;
    case 'message_end':
      if (event.messageId !== summary.streamingMessageId) return summary;
      return { ...summary, lastMessage: summary.draft, streamingMessageId: null, draft: '', updatedAt: now() };
    case 'status':
      return { ...summary, status: event.status, updatedAt: now() };
    case 'tool_call':
      return { ...summary, handoffReason: event.args.reason };
  }
}

function applyToThread(thread: Thread, event: StreamEvent): Thread {
  if (event.id <= thread.watermark) return thread;

  switch (event.type) {
    case 'message':
      return upsertMessage(thread, event.message);
    case 'message_start':
      if (thread.itemsById[event.messageId]) return thread;
      return addItem(thread, {
        kind: 'message',
        id: event.messageId,
        message: {
          id: event.messageId,
          conversationId: event.conversationId,
          role: 'ai',
          text: '',
          createdAt: now(),
          streaming: true,
        },
      });
    case 'token':
      return updateMessage(thread, event.messageId, (message) => ({ ...message, text: message.text + event.text }));
    case 'message_end':
      return updateMessage(thread, event.messageId, (message) => ({ ...message, streaming: undefined }));
    case 'tool_call':
      return addItem(thread, { kind: 'handoff', id: `handoff-${event.id}`, reason: event.args.reason });
    case 'status':
      return thread;
  }
}

// ---- Replies sent by the supervisor (optimistic) -----------------------------------------

export function addPendingMessage(
  state: LiveState,
  conversationId: string,
  clientMessageId: string,
  text: string,
): LiveState {
  const message: Message = {
    id: clientMessageId,
    conversationId,
    role: 'human',
    text,
    createdAt: now(),
    clientMessageId,
  };
  return updateThreadIn(state, conversationId, (thread) =>
    addItem(thread, { kind: 'message', id: clientMessageId, message, delivery: 'pending' }),
  );
}

// Called with the 201 response. The SSE echo of the same message goes through applyEvent,
// and both paths end in upsertMessage, so whichever arrives second changes nothing.
export function confirmMessage(state: LiveState, conversationId: string, message: Message): LiveState {
  return updateThreadIn(state, conversationId, (thread) => upsertMessage(thread, message));
}

export function setMessageDelivery(
  state: LiveState,
  conversationId: string,
  itemId: string,
  delivery: Delivery,
  error?: string,
): LiveState {
  return updateThreadIn(state, conversationId, (thread) => {
    const item = thread.itemsById[itemId];
    if (!item || item.kind !== 'message') return thread;
    return { ...thread, itemsById: { ...thread.itemsById, [itemId]: { ...item, delivery, error } } };
  });
}

export function discardMessage(state: LiveState, conversationId: string, itemId: string): LiveState {
  return updateThreadIn(state, conversationId, (thread) => {
    const itemsById = { ...thread.itemsById };
    delete itemsById[itemId];
    return { ...thread, itemIds: thread.itemIds.filter((id) => id !== itemId), itemsById };
  });
}

export function setConversationStatus(state: LiveState, conversationId: string, status: Status): LiveState {
  const summary = state.conversations[conversationId];
  if (!summary) return state;
  return { ...state, conversations: { ...state.conversations, [conversationId]: { ...summary, status } } };
}

// ---- Small helpers -----------------------------------------------------------------------

// listeningFrom is the cursor when the thread started buffering events. The messages query is
// keyed by it, so the thread is always filled from a snapshot fetched after that moment.
function createLoadingThread(cursor: number): Thread {
  return { status: 'loading', listeningFrom: cursor, watermark: 0, itemIds: [], itemsById: {}, buffer: [] };
}

function toItem(message: Message): ThreadItem {
  return { kind: 'message', id: message.id, message };
}

function addItem(thread: Thread, item: ThreadItem): Thread {
  return { ...thread, itemIds: [...thread.itemIds, item.id], itemsById: { ...thread.itemsById, [item.id]: item } };
}

// A reply we sent is stored under its clientMessageId, so the list key stays the same when the server confirms it.
function findExistingItemId(thread: Thread, message: Message): string | null {
  if (thread.itemsById[message.id]) return message.id;
  if (message.clientMessageId && thread.itemsById[message.clientMessageId]) return message.clientMessageId;
  return null;
}

function upsertMessage(thread: Thread, message: Message): Thread {
  const existingId = findExistingItemId(thread, message);
  const item: ThreadItem = {
    kind: 'message',
    id: existingId ?? message.id,
    message,
    delivery: message.clientMessageId ? 'sent' : undefined,
  };

  if (existingId) {
    return { ...thread, itemsById: { ...thread.itemsById, [existingId]: item } };
  }
  return addItem(thread, item);
}

function updateMessage(thread: Thread, itemId: string, change: (message: Message) => Message): Thread {
  const item = thread.itemsById[itemId];
  if (!item || item.kind !== 'message') return thread;
  return { ...thread, itemsById: { ...thread.itemsById, [itemId]: { ...item, message: change(item.message) } } };
}

function updateThreadIn(state: LiveState, conversationId: string, change: (thread: Thread) => Thread): LiveState {
  const thread = state.threads[conversationId];
  if (!thread) return state;
  return { ...state, threads: { ...state.threads, [conversationId]: change(thread) } };
}

function moveToTop(order: string[], conversationId: string): string[] {
  return [conversationId, ...order.filter((id) => id !== conversationId)];
}

function now(): string {
  return new Date().toISOString();
}
