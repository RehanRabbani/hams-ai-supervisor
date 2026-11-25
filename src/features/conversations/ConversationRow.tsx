import { memo } from 'react';
import { Avatar } from '../../components/Avatar';
import { StatusBadge } from '../../components/StatusBadge';
import { useLiveStore } from '../../live/store';
import { formatTime } from '../../utils/format';

// Takes only an id and reads its own conversation from the store, so a token in one
// conversation re-renders that row only, not the whole list.
// Mixed Arabic and English: dir="auto" lets the name and preview read (and truncate) in their own
// direction. Their boxes are only as wide as the text, so they still sit at the start of the row.
export const ConversationRow = memo(function ConversationRow({ id }: { id: string }) {
  const conversation = useLiveStore((state) => state.conversations[id]);
  const isSelected = useLiveStore((state) => state.selectedId === id);
  const selectConversation = useLiveStore((state) => state.selectConversation);

  const isTyping = conversation.streamingMessageId !== null;

  return (
    <button
      type="button"
      aria-current={isSelected ? 'true' : undefined}
      onClick={() => selectConversation(id)}
      className={`flex w-full items-start gap-3 rounded-xl p-3 text-start ${isSelected ? 'bg-accent-soft' : 'hover:bg-canvas'}`}
    >
      <Avatar name={conversation.customer} status={conversation.status} />

      <span className="flex min-w-0 flex-1 flex-col gap-0.75">
        <span className="flex items-center gap-2">
          <span dir="auto" className="min-w-0 truncate font-semibold">
            {conversation.customer}
          </span>
          <span className="ms-auto shrink-0 text-xs text-muted">
            <bdi>{formatTime(conversation.updatedAt)}</bdi>
          </span>
        </span>

        <span className="flex items-center gap-2">
          {isTyping ? (
            <span className="flex flex-1 items-center gap-1.5 text-[13px] text-ai-fg">
              AI is replying
              <TypingDots />
            </span>
          ) : (
            <span dir="auto" className="min-w-0 truncate text-[13px] text-text-2">
              {conversation.lastMessage}
            </span>
          )}
          {conversation.unread > 0 && (
            <span
              aria-label={`${conversation.unread} unread`}
              className="ms-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white"
            >
              {conversation.unread}
            </span>
          )}
        </span>

        <span>
          <StatusBadge status={conversation.status} />
        </span>
      </span>
    </button>
  );
});

function TypingDots() {
  return (
    <span aria-hidden="true" className="inline-flex gap-0.75">
      <span className="size-1 animate-typing rounded-full bg-ai-dot" />
      <span className="size-1 animate-typing rounded-full bg-ai-dot [animation-delay:0.2s]" />
      <span className="size-1 animate-typing rounded-full bg-ai-dot [animation-delay:0.4s]" />
    </span>
  );
}
