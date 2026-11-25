import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectEventStream, retryDelay } from '../src/live/sseClient';
import type { ConnectionStatus } from '../src/live/store';

// A minimal stand-in for the browser's EventSource, so the test can open, drop and feed the stream.
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((message: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
  }
}

function latestSource() {
  return FakeEventSource.instances[FakeEventSource.instances.length - 1];
}

describe('connectEventStream', () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.stubGlobal('EventSource', FakeEventSource);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('reconnects from the latest cursor after a drop, not from the first URL', () => {
    let cursor = 7;
    const statuses: ConnectionStatus[] = [];
    const received: number[] = [];

    const stop = connectEventStream({
      getCursor: () => cursor,
      onEvent: (event) => {
        received.push(event.id);
        cursor = event.id;
      },
      onStatus: (status) => statuses.push(status),
    });

    expect(latestSource().url).toBe('http://localhost:4000/events?since=7');
    latestSource().onopen?.();
    latestSource().onmessage?.({
      data: JSON.stringify({ id: 8, type: 'status', conversationId: 'c-1', status: 'ai' }),
    });
    latestSource().onmessage?.({
      data: JSON.stringify({ id: 9, type: 'status', conversationId: 'c-1', status: 'ai' }),
    });

    const dropped = latestSource();
    dropped.onerror?.();
    expect(dropped.closed).toBe(true);

    vi.advanceTimersByTime(retryDelay(1));
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(latestSource().url).toBe('http://localhost:4000/events?since=9');

    latestSource().onopen?.();
    expect(received).toEqual([8, 9]);
    expect(statuses).toEqual(['connected', 'reconnecting', 'reconnected']);

    // "Reconnected" stays for 3 seconds so a quick drop is still visible, then it says "Connected".
    vi.advanceTimersByTime(3000);
    expect(statuses).toEqual(['connected', 'reconnecting', 'reconnected', 'connected']);

    stop();
    expect(latestSource().closed).toBe(true);
  });

  it('backs off between failed attempts and shows offline after five failures', () => {
    const statuses: ConnectionStatus[] = [];
    connectEventStream({ getCursor: () => 0, onEvent: () => {}, onStatus: (status) => statuses.push(status) });

    for (let attempt = 1; attempt <= 6; attempt++) {
      latestSource().onerror?.();
      vi.advanceTimersByTime(retryDelay(attempt));
    }

    expect(retryDelay(1)).toBe(500);
    expect(retryDelay(4)).toBe(4000);
    expect(retryDelay(10)).toBe(5000);
    expect(statuses.slice(0, 5)).toEqual(Array(5).fill('reconnecting'));
    expect(statuses[5]).toBe('offline');
    expect(FakeEventSource.instances).toHaveLength(7);
  });
});
