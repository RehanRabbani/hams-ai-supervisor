import { useEffect } from 'react';
import { useMessages } from '../../api/queries';
import { useLiveStore } from '../../live/store';
import { Composer } from './Composer';
import { MessageList } from './MessageList';
import { ThreadHeader } from './ThreadHeader';

export function ThreadPanel() {
  const selectedId = useLiveStore((state) => state.selectedId);

  if (!selectedId) {
    return (
      <main className="flex flex-1 items-center justify-center text-muted">
        Select a conversation to see its messages
      </main>
    );
  }

  // The key gives each conversation a fresh component, so the message list starts at the bottom.
  return <ConversationThread key={selectedId} conversationId={selectedId} />;
}

function ConversationThread({ conversationId }: { conversationId: string }) {
  const status = useLiveStore((state) => state.threads[conversationId]?.status);
  const listeningFrom = useLiveStore((state) => state.threads[conversationId]?.listeningFrom ?? null);
  const needsResync = useLiveStore((state) => state.needsResync);
  const messages = useMessages(conversationId, status === 'loading' ? listeningFrom : null);

  // A resync drops every thread from the store. Start loading the open one again.
  useEffect(() => {
    if (!status && !needsResync) {
      useLiveStore.getState().selectConversation(conversationId);
    }
  }, [status, needsResync, conversationId]);

  useEffect(() => {
    if (status === 'loading' && messages.data) {
      useLiveStore.getState().seedThread(conversationId, messages.data.messages, messages.data.lastEventId);
    }
  }, [status, messages.data, conversationId]);

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <ThreadHeader conversationId={conversationId} />

      {status === 'ready' ? (
        <>
          <MessageList conversationId={conversationId} />
          <Composer conversationId={conversationId} />
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center gap-2 text-muted">
          {messages.isError ? (
            <>
              <bdi>Could not load the messages.</bdi>
              <button type="button" onClick={() => messages.refetch()} className="font-semibold text-accent">
                Retry
              </button>
            </>
          ) : (
            <bdi>Loading messages…</bdi>
          )}
        </div>
      )}
    </main>
  );
}
