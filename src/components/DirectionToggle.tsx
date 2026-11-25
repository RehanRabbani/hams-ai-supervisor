import { useLiveStore, type Direction } from '../live/store';

const OPTIONS: { value: Direction; label: string }[] = [
  { value: 'ltr', label: 'LTR' },
  { value: 'rtl', label: 'RTL · عربي' },
];

export function DirectionToggle() {
  const direction = useLiveStore((state) => state.direction);
  const setDirection = useLiveStore((state) => state.setDirection);

  return (
    <div role="group" aria-label="Text direction" className="flex rounded-lg border border-line bg-closed-bg p-0.75">
      {OPTIONS.map((option) => {
        const isActive = option.value === direction;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => setDirection(option.value)}
            className={`h-7 rounded-md px-2.5 text-xs font-semibold ${
              isActive ? 'bg-surface text-ink shadow-sm' : 'text-text-2 hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
