import type { Status } from '../api/types';

export const STATUS_STYLES: Record<Status, { label: string; badge: string; dot: string; avatar: string }> = {
  ai: { label: 'AI handling', badge: 'bg-ai-bg text-ai-fg', dot: 'bg-ai-dot', avatar: 'bg-ai-bg text-ai-fg' },
  needs_human: {
    label: 'Needs human',
    badge: 'bg-needs-bg text-needs-fg',
    dot: 'bg-needs-dot',
    avatar: 'bg-needs-line text-needs-fg',
  },
  human: {
    label: 'Human handling',
    badge: 'bg-human-bg text-human-fg',
    dot: 'bg-human-dot',
    avatar: 'bg-human-line text-human-fg',
  },
  closed: {
    label: 'Closed',
    badge: 'bg-closed-bg text-closed-fg',
    dot: 'bg-closed-dot',
    avatar: 'bg-closed-bg text-closed-fg',
  },
};

export function StatusBadge({ status }: { status: Status }) {
  const style = STATUS_STYLES[status];
  return (
    <span className={`inline-flex h-5.5 items-center gap-1.5 rounded-full px-2 text-xs font-medium ${style.badge}`}>
      <span aria-hidden="true" className={`size-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}
