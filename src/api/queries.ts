import { useQuery } from '@tanstack/react-query';
import { fetchConversations, fetchMessages } from './client';

export function useConversations() {
  return useQuery({ queryKey: ['conversations'], queryFn: fetchConversations });
}

// `listeningFrom` is part of the key so a thread that starts loading always gets a fresh
// snapshot, never a cached one taken before it started buffering live events.
export function useMessages(conversationId: string | null, listeningFrom: number | null) {
  return useQuery({
    queryKey: ['messages', conversationId, listeningFrom],
    queryFn: () => fetchMessages(conversationId!),
    enabled: conversationId !== null && listeningFrom !== null,
  });
}
