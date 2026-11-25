import { useLiveStore, type ConnectionStatus } from '../live/store';

const PILL_STYLES: Record<ConnectionStatus, { label: string; pill: string; dot: string }> = {
  connecting: { label: 'Connecting…', pill: 'bg-closed-bg text-closed-fg', dot: 'bg-closed-dot' },
  connected: { label: 'Connected', pill: 'bg-online-bg text-online-fg', dot: 'bg-online-dot' },
  reconnected: { label: 'Reconnected', pill: 'bg-online-bg text-online-fg', dot: 'bg-online-dot' },
  reconnecting: { label: 'Reconnecting…', pill: 'bg-needs-bg text-needs-fg', dot: 'bg-needs-dot animate-pulse' },
  offline: { label: 'Offline', pill: 'bg-error-bg text-error', dot: 'bg-error' },
};

export function ConnectionPill() {
  const connection = useLiveStore((state) => state.connection);
  const cursor = useLiveStore((state) => state.cursor);
  const style = PILL_STYLES[connection];
  const eventNumber = `#${cursor.toLocaleString()}`;

  let detail = '';
  if (connection === 'connected' || connection === 'reconnected') detail = `event ${eventNumber}`;
  if (connection === 'reconnecting') detail = `resuming from ${eventNumber}`;
  if (connection === 'offline') detail = 'still retrying';

  return (
    <div
      role="status"
      className={`inline-flex h-7.5 items-center gap-2 rounded-full px-3 text-[13px] font-medium ${style.pill}`}
    >
      <span aria-hidden="true" className={`size-2 rounded-full ${style.dot}`} />
      <bdi>{style.label}</bdi>
      {detail && (
        <span className="font-normal">
          <bdi>{detail}</bdi>
        </span>
      )}
    </div>
  );
}
