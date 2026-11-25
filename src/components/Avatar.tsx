import type { Status } from '../api/types';
import { initials } from '../utils/format';
import { STATUS_STYLES } from './StatusBadge';

export function Avatar({ name, status }: { name: string; status: Status }) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-10 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold ${STATUS_STYLES[status].avatar}`}
    >
      {initials(name)}
    </span>
  );
}
