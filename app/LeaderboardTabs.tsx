'use client';
import { ViewTransition } from 'react';
import type { Leaderboards, BoardEntry } from '../lib/stats/hands';
import { LeaderLine } from '../lib/ui/deli';
import { useAutoRotate } from '../lib/ui/useAutoRotate';

type BoardKey = keyof Leaderboards;

const TABS: { key: BoardKey; label: string; blurb: string; fmt: (e: BoardEntry) => string; hint: (e: BoardEntry) => string; good: (e: BoardEntry) => boolean | null }[] = [
  { key: 'vsPar', label: 'vs par', blurb: 'Hands won vs what chance would give you',
    fmt: (e) => `${e.value.toFixed(2)}×`, hint: (e) => `${e.count}/${e.hands} hands`, good: (e) => e.value >= 1 },
  { key: 'pointsPerHand', label: 'Pts', blurb: 'Points taken per hand — lower is better',
    fmt: (e) => e.value.toFixed(1), hint: (e) => `${e.hands} hands`, good: () => null },
  { key: 'winsPer100', label: 'Wins', blurb: 'Hands won per 100 hands',
    fmt: (e) => e.value.toFixed(1), hint: (e) => `${e.count}/${e.hands} hands`, good: () => null },
  { key: 'kalookisPer100', label: 'Kalookis', blurb: 'Kalookis per 100 hands',
    fmt: (e) => e.value.toFixed(1), hint: (e) => `${e.count}/${e.hands} hands`, good: () => null },
  { key: 'treasuresPer100', label: 'Treasures', blurb: 'Treasures per 100 hands',
    fmt: (e) => e.value.toFixed(1), hint: (e) => `${e.count}/${e.hands} hands`, good: () => null },
];

const ROTATE_MS = 6000;

/** The leaderboard as a deli menu: "Choice of:" lists, rotating every few seconds until you pick one. */
export function LeaderboardTabs({ boards, meId, minHands }: { boards: Leaderboards; meId: string; minHands: number }) {
  // Only lists with someone on them take part in the rotation.
  const filled = TABS.map((x) => x.key).filter((k) => boards[k].length > 0);
  const rot = useAutoRotate<BoardKey>(filled.length ? filled : ['vsPar'], { intervalMs: ROTATE_MS, initial: filled[0] ?? 'vsPar' });
  const tab = rot.current;
  const t = TABS.find((x) => x.key === tab)!;
  const entries = boards[tab];
  return (
    <div
      onMouseEnter={() => rot.hold('hover', true)}
      onMouseLeave={() => rot.hold('hover', false)}
      onFocus={() => rot.hold('focus', true)}
      // Only release when focus actually leaves the leaderboard (not when it moves between choices).
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) rot.hold('focus', false); }}
    >
      <div role="tablist" aria-label="Leaderboards" className="mt-2 flex flex-wrap items-baseline justify-center gap-x-3.5 gap-y-1">
        <span aria-hidden className="font-script text-[19px] text-deli-red">Choice of:</span>
        {TABS.map((x) => {
          const on = x.key === tab;
          return (
            <button
              key={x.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => rot.select(x.key)}
              className={`relative pb-1 font-cond text-[15px] font-extrabold uppercase tracking-[.08em] transition-opacity ${on ? 'opacity-100' : 'opacity-50 hover:opacity-80'}`}
            >
              {x.label}
              {on && (
                rot.running
                  // Fills over the 6s countdown; restarts whenever a fresh countdown begins.
                  ? <span key={rot.cycle} aria-hidden className="deli-progress absolute inset-x-0 bottom-0 h-[2px]" />
                  : <span aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-deli-green" />
              )}
            </button>
          );
        })}
      </div>
      {/* Switching lists crossfades the blurb + list (the choices stay put). */}
      <ViewTransition key={tab} name="leaderboard-list" share="vt-tab" enter="vt-tab" exit="vt-tab" default="none">
        <div>
          <p className="mt-1 px-1 text-center font-sans-deli text-[11px] italic opacity-65">{t.blurb}</p>
          {entries.length === 0 ? (
            <p className="px-1 py-3 font-sans-deli text-sm text-deli-green/75">Nobody qualifies yet — players appear here once they&apos;ve played at least {minHands} hands.</p>
          ) : (
            <ol role="tabpanel">
              {entries.map((e, i) => {
                const good = t.good(e);
                return (
                  <li key={e.userId} className={e.userId === meId ? 'rounded-md bg-deli-gold/15' : ''}>
                    <LeaderLine label={`${i + 1} · ${e.name}`} sub={t.hint(e)} value={t.fmt(e)} tone={good === false ? 'red' : 'default'} />
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </ViewTransition>
    </div>
  );
}
