import { Avatar } from '../../components/Avatar';
import { StatusBadge } from '../../components/StatusBadge';
import { useLiveStore } from '../../live/store';

export function ThreadHeader({ conversationId }: { conversationId: string }) {
  const conversation = useLiveStore((state) => state.conversations[conversationId]);
  const messageCount = useLiveStore((state) => state.threads[conversationId]?.itemIds.length ?? 0);

  return (
    <div className="flex h-17 shrink-0 items-center gap-3 border-b border-line bg-surface px-6">
      <Avatar name={conversation.customer} status={conversation.status} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5">
          <h2 dir="auto" className="min-w-0 truncate text-base font-semibold">
            {conversation.customer}
          </h2>
          <StatusBadge status={conversation.status} />
        </div>
        <div className="text-[13px] text-muted">
          <bdi>
            {conversationId} · {messageCount.toLocaleString()} messages
          </bdi>
        </div>
      </div>
    </div>
  );
}
