import type { ReactNode } from 'react';

const TONE = { default: 'text-deli-green', red: 'text-deli-red', muted: 'text-deli-green/45' } as const;

/** A menu line: LABEL ………… VALUE, with an optional small line under the label. */
export function LeaderLine({ label, value, tone = 'default', sub }: {
  label: ReactNode; value: ReactNode; tone?: keyof typeof TONE; sub?: ReactNode;
}) {
  return (
    <div className="deli-leader font-cond uppercase leading-[.9]">
      <span className="min-w-0">
        <span className="text-[22px] font-extrabold sm:text-[24px]">{label}</span>
        {sub && <span className="mt-0.5 block font-sans-deli text-[11px] font-medium normal-case tracking-normal opacity-70">{sub}</span>}
      </span>
      <span aria-hidden className="lead" />
      <span className={`text-[24px] font-black tabular-nums sm:text-[27px] ${TONE[tone]}`}>{value}</span>
    </div>
  );
}
