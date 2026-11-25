import { ConnectionPill } from './ConnectionPill';
import { DirectionToggle } from './DirectionToggle';

export function TopBar() {
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-line bg-surface px-5">
      <div className="flex items-center gap-2.5">
        <div
          aria-hidden="true"
          className="flex size-7.5 items-center justify-center rounded-lg bg-ink text-sm font-bold text-white"
        >
          H
        </div>
        <span className="text-[15px] font-semibold">Hams.AI</span>
        <span className="border-s border-line ps-2.5 text-[13px] text-muted">Live monitor</span>
      </div>

      <div className="flex-1" />

      <ConnectionPill />
      <DirectionToggle />
    </header>
  );
}
