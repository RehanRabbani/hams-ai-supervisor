import { useMutation } from '@tanstack/react-query';
import { useLiveStore } from '../live/store';
import { sendMessage, takeOver } from './client';

// The store updates live in the useMutation options, not in mutate() callbacks: options run for
// every call, while mutate() callbacks only run for the most recent one, which breaks quick sends and retries.

export function useTakeOver() {
  return useMutation({
    mutationFn: (conversationId: string) => takeOver(conversationId),
    // Usually a `status` event arrives too, but the mock sends none if the conversation was already human.
    onSuccess: ({ conversation }) =>
      useLiveStore.getState().setConversationStatus(conversation.id, conversation.status),
  });
}

interface Reply {
  conversationId: string;
  clientMessageId: string;
  text: string;
}

export function useSendMessage() {
  return useMutation({
    mutationFn: (reply: Reply) => sendMessage(reply.conversationId, reply.text, reply.clientMessageId),
    onSuccess: ({ message }, reply) => useLiveStore.getState().confirmMessage(reply.conversationId, message),
    onError: (error, reply) =>
      useLiveStore.getState().setMessageDelivery(reply.conversationId, reply.clientMessageId, 'failed', error.message),
  });
}
