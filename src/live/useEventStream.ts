import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useConversations } from '../api/queries';
import { connectEventStream } from './sseClient';
import { useLiveStore } from './store';

// Connects the REST snapshot and the live stream:
// 1. When a conversations snapshot arrives, seed the store from it.
// 2. Open the stream from the snapshot's lastEventId, and reconnect from the store's cursor.
// 3. If the reducer reports a gap or a server restart, close the stream and refetch everything.
export function useEventStream() {
  const queryClient = useQueryClient();
  const { data, dataUpdatedAt } = useConversations();
  const needsResync = useLiveStore((state) => state.needsResync);
  const hasSnapshot = data !== undefined;

  // dataUpdatedAt changes on every successful fetch, even when TanStack Query keeps the same
  // data object because nothing changed. Without it a resync could wait forever.
  useEffect(() => {
    if (!data) return;
    useLiveStore.getState().seedConversations(data.conversations, data.lastEventId);
  }, [data, dataUpdatedAt]);

  useEffect(() => {
    if (!hasSnapshot || needsResync) return;
    const { applyEvent, setConnection } = useLiveStore.getState();
    return connectEventStream({
      getCursor: () => useLiveStore.getState().cursor,
      onEvent: applyEvent,
      onStatus: setConnection,
    });
  }, [hasSnapshot, needsResync]);

  useEffect(() => {
    if (!needsResync) return;
    useLiveStore.getState().setConnection('reconnecting');
    void queryClient.invalidateQueries();
  }, [needsResync, queryClient]);
}
