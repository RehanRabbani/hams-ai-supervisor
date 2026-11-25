import { useRef, useState } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { useLiveStore } from '../../live/store';
import { ThreadItemRow } from './ThreadItemRow';

// A shared empty array: a selector that returned a new [] on every call would re-render forever.
const NO_ITEMS: string[] = [];

export function MessageList({ conversationId }: { conversationId: string }) {
  const itemIds = useLiveStore((state) => state.threads[conversationId]?.itemIds ?? NO_ITEMS);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  return (
    <section aria-label="Messages" className="relative min-h-0 flex-1">
      <Virtuoso
        ref={virtuosoRef}
        style={{ height: '100%' }}
        data={itemIds}
        computeItemKey={(_, itemId) => itemId}
        initialTopMostItemIndex={itemIds.length - 1}
        followOutput={(atBottom) => (atBottom ? 'smooth' : false)}
        atBottomStateChange={setIsAtBottom}
        atBottomThreshold={80}
        itemContent={(_, itemId) => <ThreadItemRow conversationId={conversationId} itemId={itemId} />}
        components={{ Header: ListPadding, Footer: ListPadding }}
      />

      {!isAtBottom && (
        <button
          type="button"
          onClick={() => virtuosoRef.current?.scrollToIndex({ index: 'LAST', behavior: 'smooth' })}
          className="absolute inset-x-0 bottom-4 mx-auto w-fit rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-white shadow-md"
        >
          Jump to latest ↓
        </button>
      )}
    </section>
  );
}

function ListPadding() {
  return <div className="h-4" />;
}
