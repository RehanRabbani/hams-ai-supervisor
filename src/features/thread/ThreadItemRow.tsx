import { memo } from 'react';
import { useSendMessage } from '../../api/mutations';
import type { Role } from '../../api/types';
import type { ThreadItem } from '../../live/reducer';
import { useLiveStore } from '../../live/store';
import { formatTime } from '../../utils/format';

type MessageItem = Extract<ThreadItem, { kind: 'message' }>;

// Like ConversationRow: takes ids and reads its own item, so a token re-renders only the streaming bubble.
export const ThreadItemRow = memo(function ThreadItemRow({
  conversationId,
  itemId,
}: {
  conversationId: string;
  itemId: string;
}) {
  const item = useLiveStore((state) => state.threads[conversationId]?.itemsById[itemId]);
  if (!item) return null;

  return (
    <div className="flex flex-col px-6 py-1.5">
      {item.kind === 'handoff' ? (
        <HandoffCard reason={item.reason} />
      ) : (
        <MessageBubble conversationId={conversationId} item={item} />
      )}
    </div>
  );
});

const ROLE_STYLES: Record<Role, { label: string; column: string; bubble: string }> = {
  customer: { label: 'Customer', column: 'self-start items-start', bubble: 'border-line bg-surface rounded-es-sm' },
  ai: { label: 'AI agent', column: 'self-end items-end', bubble: 'border-accent-line bg-accent-soft rounded-ee-sm' },
  human: { label: 'Supervisor', column: 'self-end items-end', bubble: 'border-human-line bg-human-bg rounded-ee-sm' },
};

function MessageBubble({ conversationId, item }: { conversationId: string; item: MessageItem }) {
  const { message, delivery } = item;
  const style = ROLE_STYLES[message.role];
  const isFailed = delivery === 'failed';
  const bubbleStyle = isFailed ? 'border-dashed border-error-line bg-error-bg text-text-2 rounded-ee-sm' : style.bubble;

  let status = '';
  if (message.streaming) status = ' · typing';
  if (delivery === 'pending') status = ' · Sending…';
  if (delivery === 'sent') status = ' · Sent ✓';

  return (
    <div className={`flex max-w-[64%] flex-col gap-1 ${style.column}`}>
      <div dir="auto" className={`rounded-2xl border px-3.5 py-2.5 break-words whitespace-pre-wrap ${bubbleStyle}`}>
        {message.text}
        {message.streaming && (
          <span aria-hidden="true" className="ms-0.5 inline-block h-4 w-0.5 animate-caret bg-accent align-[-2px]" />
        )}
      </div>
      {isFailed ? (
        <FailedReply conversationId={conversationId} item={item} />
      ) : (
        <span className="px-1 text-xs text-muted">
          <bdi>
            {style.label} · {formatTime(message.createdAt)}
            {status}
          </bdi>
        </span>
      )}
    </div>
  );
}

// The rolled-back state of a reply the server rejected. Retry sends it again with the same
// clientMessageId, so if it succeeds it replaces this bubble instead of adding a second one.
function FailedReply({ conversationId, item }: { conversationId: string; item: MessageItem }) {
  const sendMessage = useSendMessage();

  function retry() {
    useLiveStore.getState().setMessageDelivery(conversationId, item.id, 'pending');
    sendMessage.mutate({ conversationId, clientMessageId: item.id, text: item.message.text });
  }

  return (
    <div role="alert" className="flex flex-wrap items-center gap-x-2.5 px-1 text-xs text-error">
      <bdi>
        Not sent: <bdi>{item.error}</bdi>
      </bdi>
      <button type="button" onClick={retry} className="font-semibold text-accent hover:underline">
        Retry
      </button>
      <button
        type="button"
        onClick={() => useLiveStore.getState().discardMessage(conversationId, item.id)}
        className="text-text-2 hover:underline"
      >
        Discard
      </button>
    </div>
  );
}

function HandoffCard({ reason }: { reason: string }) {
  return (
    <div
      role="note"
      className="flex w-full max-w-130 gap-3 self-center rounded-xl border border-needs-line bg-needs-bg px-4 py-3 text-needs-fg"
    >
      <svg
        aria-hidden="true"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="mt-px shrink-0 text-needs-dot"
      >
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      </svg>
      <div className="flex flex-col gap-0.5">
        <strong className="font-semibold">AI requested a human</strong>
        <bdi>
          Reason: <bdi>{reason}</bdi>
        </bdi>
      </div>
    </div>
  );
}
