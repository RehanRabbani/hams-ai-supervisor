import { useEffect } from 'react';
import { TopBar } from './components/TopBar';
import { ConversationList } from './features/conversations/ConversationList';
import { ThreadPanel } from './features/thread/ThreadPanel';
import { useLiveStore } from './live/store';
import { useEventStream } from './live/useEventStream';

export default function App() {
  useEventStream();
  const direction = useLiveStore((state) => state.direction);

  useEffect(() => {
    document.documentElement.dir = direction;
  }, [direction]);

  return (
    <div className="flex h-screen flex-col">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <ConversationList />
        <ThreadPanel />
      </div>
    </div>
  );
}
