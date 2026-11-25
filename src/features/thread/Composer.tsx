import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { useSendMessage, useTakeOver } from '../../api/mutations';
import { useLiveStore } from '../../live/store';

export function Composer({ conversationId }: { conversationId: string }) {
  const status = useLiveStore((state) => state.conversations[conversationId].status);

  return (
    <div className="shrink-0 border-t border-line bg-surface px-6 pt-4 pb-5">
      {status === 'human' ? (
        <ReplyForm conversationId={conversationId} />
      ) : (
        <LockedComposer conversationId={conversationId} />
      )}
    </div>
  );
}

function LockedComposer({ conversationId }: { conversationId: string }) {
  const conversation = useLiveStore((state) => state.conversations[conversationId]);
  const takeOver = useTakeOver();

  if (conversation.status === 'closed') {
    return <LockedNote>This conversation is closed.</LockedNote>;
  }

  if (conversation.status === 'ai') {
    return <LockedNote>The AI is handling this conversation. You can step in when it asks for help.</LockedNote>;
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-needs-line bg-needs-bg px-4 py-3 text-needs-fg">
      <div className="min-w-0 flex-1">
        <div className="font-semibold">The AI asked for a person</div>
        <div>
          <bdi>
            Reason: <bdi>{conversation.handoffReason ?? 'not available'}</bdi>
          </bdi>
        </div>
        {takeOver.isError && (
          <div role="alert" className="mt-1 text-error">
            <bdi>Could not take over: {takeOver.error.message}</bdi>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => takeOver.mutate(conversationId)}
        disabled={takeOver.isPending}
        className="h-10 shrink-0 rounded-[10px] bg-accent px-4 font-semibold text-white hover:bg-ai-fg disabled:opacity-60"
      >
        <bdi>{takeOver.isPending ? 'Taking over…' : 'Take over'}</bdi>
      </button>
    </div>
  );
}

function LockedNote({ children }: { children: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong bg-canvas px-4 py-3.5 text-text-2">
      <bdi>{children}</bdi>
    </div>
  );
}

function ReplyForm({ conversationId }: { conversationId: string }) {
  const [text, setText] = useState('');
  const sendMessage = useSendMessage();
  const trimmed = text.trim();

  function send() {
    if (!trimmed) return;
    const clientMessageId = crypto.randomUUID();
    useLiveStore.getState().addPendingMessage(conversationId, clientMessageId, trimmed);
    sendMessage.mutate({ conversationId, clientMessageId, text: trimmed });
    setText('');
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    send();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex items-end gap-2.5 rounded-xl border border-line-strong bg-surface py-2 ps-3.5 pe-2 focus-within:border-accent">
        <textarea
          rows={2}
          dir="auto"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write a reply"
          aria-label="Reply to the customer"
          className="min-w-0 flex-1 resize-none bg-transparent py-1.5 text-ink outline-none placeholder:text-muted"
        />
        <button
          type="submit"
          disabled={!trimmed}
          className="h-10 shrink-0 rounded-[10px] bg-accent px-4 font-semibold text-white hover:bg-ai-fg disabled:opacity-50"
        >
          Send
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">Enter to send · Shift + Enter for a new line</p>
    </form>
  );
}
