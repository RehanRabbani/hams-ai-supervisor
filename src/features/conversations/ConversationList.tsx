import { useState } from 'react';
import { useConversations } from '../../api/queries';
import type { Status } from '../../api/types';
import { useLiveStore } from '../../live/store';
import { ConversationRow } from './ConversationRow';

type Filter = 'all' | Status;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'needs_human', label: 'Needs human' },
  { value: 'ai', label: 'AI' },
  { value: 'human', label: 'Human' },
];

export function ConversationList() {
  const order = useLiveStore((state) => state.order);
  const conversations = useLiveStore((state) => state.conversations);
  const conversationsQuery = useConversations();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const query = search.trim().toLowerCase();
  const visibleIds = order.filter((id) => {
    const conversation = conversations[id];
    const matchesFilter = filter === 'all' || conversation.status === filter;
    const matchesSearch =
      query === '' ||
      conversation.customer.toLowerCase().includes(query) ||
      conversation.lastMessage.toLowerCase().includes(query);
    return matchesFilter && matchesSearch;
  });

  const countFor = (value: Filter) =>
    value === 'all' ? order.length : order.filter((id) => conversations[id].status === value).length;
  const activeCount = order.filter((id) => conversations[id].status !== 'closed').length;

  return (
    <aside aria-label="Conversations" className="flex w-90 shrink-0 flex-col border-e border-line bg-surface">
      <div className="flex flex-col gap-3 px-4 pt-4 pb-3">
        <div className="flex items-baseline justify-between">
          <h1 className="text-lg font-semibold">Conversations</h1>
          <span className="text-[13px] text-muted">
            <bdi>{activeCount} active</bdi>
          </span>
        </div>

        <label className="flex h-9.5 items-center gap-2 rounded-[10px] border border-line-strong px-3 text-muted focus-within:border-accent">
          <SearchIcon />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or message"
            aria-label="Search conversations"
            className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted"
          />
        </label>

        <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
          {FILTERS.map((option) => {
            const isActive = option.value === filter;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={isActive}
                onClick={() => setFilter(option.value)}
                className={`h-7.5 rounded-full border px-3 text-[13px] font-medium ${
                  isActive
                    ? 'border-ink bg-ink text-white'
                    : 'border-line bg-surface text-text-2 hover:border-line-strong'
                }`}
              >
                {option.label} {countFor(option.value)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2">
        {conversationsQuery.isError && (
          <div role="alert" className="m-1 rounded-xl border border-error-line bg-error-bg p-3 text-[13px] text-error">
            <bdi>Could not reach the server. Is the mock server running (npm run mock)?</bdi>{' '}
            <button
              type="button"
              onClick={() => conversationsQuery.refetch()}
              className="font-semibold text-accent hover:underline"
            >
              Retry
            </button>
          </div>
        )}
        {order.length === 0 && !conversationsQuery.isError && (
          <p className="p-3 text-muted">
            <bdi>Loading conversations…</bdi>
          </p>
        )}
        {order.length > 0 && visibleIds.length === 0 && (
          <p className="p-3 text-muted">
            <bdi>No conversations match.</bdi>
          </p>
        )}
        {visibleIds.map((id) => (
          <ConversationRow key={id} id={id} />
        ))}
      </div>
    </aside>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
