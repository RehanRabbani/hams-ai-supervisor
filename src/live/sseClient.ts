import { API_URL } from '../api/client';
import type { StreamEvent } from '../api/types';
import type { ConnectionStatus } from './store';

interface EventStreamOptions {
  getCursor: () => number;
  onEvent: (event: StreamEvent) => void;
  onStatus: (status: ConnectionStatus) => void;
}

const FIRST_RETRY_MS = 500;
const MAX_RETRY_MS = 5000;
const ATTEMPTS_BEFORE_OFFLINE = 5;
const RECONNECTED_NOTICE_MS = 3000;

export function retryDelay(attempt: number): number {
  return Math.min(FIRST_RETRY_MS * 2 ** (attempt - 1), MAX_RETRY_MS);
}

// Opens the event stream and keeps it open. Returns a function that closes it for good.
export function connectEventStream({ getCursor, onEvent, onStatus }: EventStreamOptions): () => void {
  let source: EventSource | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;
  let failedAttempts = 0;
  let hasConnectedBefore = false;
  let stopped = false;

  function open() {
    source = new EventSource(`${API_URL}/events?since=${getCursor()}`);

    source.onopen = () => {
      failedAttempts = 0;
      if (hasConnectedBefore) {
        // A reconnect takes about half a second, too quick to notice, so the pill says so for a moment.
        onStatus('reconnected');
        noticeTimer = setTimeout(() => onStatus('connected'), RECONNECTED_NOTICE_MS);
      } else {
        onStatus('connected');
      }
      hasConnectedBefore = true;
    };

    source.onmessage = (message: MessageEvent<string>) => {
      onEvent(JSON.parse(message.data) as StreamEvent);
    };

    // We reconnect ourselves instead of letting the browser retry. The browser would reuse the
    // original URL, and the mock reads `since` before Last-Event-ID, so it would replay from a stale point.
    source.onerror = () => {
      source?.close();
      clearTimeout(noticeTimer);
      if (stopped) return;

      failedAttempts += 1;
      onStatus(failedAttempts > ATTEMPTS_BEFORE_OFFLINE ? 'offline' : 'reconnecting');
      retryTimer = setTimeout(open, retryDelay(failedAttempts));
    };
  }

  open();

  return () => {
    stopped = true;
    clearTimeout(retryTimer);
    clearTimeout(noticeTimer);
    source?.close();
  };
}
