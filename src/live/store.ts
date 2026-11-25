import { create } from 'zustand';
import type { Conversation, Message, Status, StreamEvent } from '../api/types';
import * as reducer from './reducer';
import type { Delivery, LiveState } from './reducer';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'reconnected' | 'offline';
export type Direction = 'ltr' | 'rtl';

interface LiveStore extends LiveState {
  connection: ConnectionStatus;
  direction: Direction;
  seedConversations: (conversations: Conversation[], lastEventId: number) => void;
  selectConversation: (conversationId: string) => void;
  seedThread: (conversationId: string, messages: Message[], lastEventId: number) => void;
  applyEvent: (event: StreamEvent) => void;
  addPendingMessage: (conversationId: string, clientMessageId: string, text: string) => void;
  confirmMessage: (conversationId: string, message: Message) => void;
  setMessageDelivery: (conversationId: string, itemId: string, delivery: Delivery, error?: string) => void;
  discardMessage: (conversationId: string, itemId: string) => void;
  setConversationStatus: (conversationId: string, status: Status) => void;
  setConnection: (connection: ConnectionStatus) => void;
  setDirection: (direction: Direction) => void;
}

const DIRECTION_KEY = 'hams.direction';

function readSavedDirection(): Direction {
  try {
    return localStorage.getItem(DIRECTION_KEY) === 'rtl' ? 'rtl' : 'ltr';
  } catch {
    return 'ltr';
  }
}

// The reducer does the real work. The store only holds its result, so components can
// subscribe to the small slice they need and re-render only when that slice changes.
export const useLiveStore = create<LiveStore>()((set) => ({
  ...reducer.initialLiveState,
  connection: 'connecting',
  direction: readSavedDirection(),

  seedConversations: (conversations, lastEventId) =>
    set((state) => reducer.seedConversations(state, conversations, lastEventId)),
  selectConversation: (conversationId) => set((state) => reducer.selectConversation(state, conversationId)),
  seedThread: (conversationId, messages, lastEventId) =>
    set((state) => reducer.seedThread(state, conversationId, messages, lastEventId)),
  applyEvent: (event) => set((state) => reducer.applyEvent(state, event)),
  addPendingMessage: (conversationId, clientMessageId, text) =>
    set((state) => reducer.addPendingMessage(state, conversationId, clientMessageId, text)),
  confirmMessage: (conversationId, message) => set((state) => reducer.confirmMessage(state, conversationId, message)),
  setMessageDelivery: (conversationId, itemId, delivery, error) =>
    set((state) => reducer.setMessageDelivery(state, conversationId, itemId, delivery, error)),
  discardMessage: (conversationId, itemId) => set((state) => reducer.discardMessage(state, conversationId, itemId)),
  setConversationStatus: (conversationId, status) =>
    set((state) => reducer.setConversationStatus(state, conversationId, status)),
  setConnection: (connection) => set({ connection }),
  setDirection: (direction) => {
    try {
      localStorage.setItem(DIRECTION_KEY, direction);
    } catch {
      // Storage can be unavailable (private mode). The toggle still works for this visit.
    }
    set({ direction });
  },
}));
