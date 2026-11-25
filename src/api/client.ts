import type { Conversation, ConversationsResponse, Message, MessagesResponse } from './types';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`);
  if (!response.ok) {
    throw new Error(`GET ${path} failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

// The mock explains failures in `{ error }`, e.g. "Random failure, please retry". We show that text.
async function postJson<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error ?? `POST ${path} failed with ${response.status}`);
  }
  return data as T;
}

export function fetchConversations(): Promise<ConversationsResponse> {
  return getJson('/conversations');
}

export function fetchMessages(conversationId: string): Promise<MessagesResponse> {
  return getJson(`/conversations/${conversationId}/messages`);
}

export function takeOver(conversationId: string): Promise<{ conversation: Conversation }> {
  return postJson(`/conversations/${conversationId}/takeover`);
}

export function sendMessage(
  conversationId: string,
  text: string,
  clientMessageId: string,
): Promise<{ message: Message }> {
  return postJson(`/conversations/${conversationId}/messages`, { text, clientMessageId });
}
