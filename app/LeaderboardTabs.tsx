'use client';
import { startTransition, useState, ViewTransition } from 'react';
import type { Leaderboards, BoardEntry } from '../lib/stats/hands';

type BoardKey = keyof Leaderboards;

const TABS: { key: BoardKey; label: string; blurb: string; fmt: (e: BoardEntry) => string; hint: (e: BoardEntry) => string; good: (e: BoardEntry) => boolean | null }[] = [
  { key: 'vsPar', label: 'vs par', blurb: 'Hands won vs what chance would give you',
    fmt: (e) => `${e.value.toFixed(2)}×`, hint: (e) => `${e.count}/${e.hands}`, good: (e) => e.value >= 1 },
  { key: 'pointsPerHand', label: 'Pts/hand', blurb: 'Points taken per hand — lower is better',
    fmt: (e) => e.value.toFixed(1), hint: (e) => `${e.hands} hands`, good: () => null },
  { key: 'winsPer100', label: 'Wins', blurb: 'Hands won per 100 hands',
    fmt: (e) => e.value.toFixed(1), hint: (e) => `${e.count}/${e.hands}`, good: () => null },
  { key: 'kalookisPer100', label: 'Kalookis', blurb: 'Kalookis per 100 hands',
    fmt: (e) => e.value.toFixed(1), hint: (e) => `${e.count}/${e.hands}`, good: () => null },
  { key: 'treasuresPer100', label: 'Treasures', blurb: 'Treasures per 100 hands',
    fmt: (e) => e.value.toFixed(1), hint: (e) => `${e.count}/${e.hands}`, good: () => null },
];

export function LeaderboardTabs({ boards, meId, minHands }: { boards: Leaderboards; meId: string; minHands: number }) {
  const [tab, setTab] = useState<BoardKey>('vsPar');
  const t = TABS.find((x) => x.key === tab)!;
  const entries = boards[tab];
  return (
    <div>
      <div role="tablist" aria-label="Leaderboards" className="flex flex-wrap gap-1 px-1 pb-1.5">
        {TABS.map((x) => (
          <button
            key={x.key}
            type="button"
            role="tab"
            aria-selected={x.key === tab}
            onClick={() => startTransition(() => setTab(x.key))}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
              x.key === tab ? 'bg-walnut text-bone' : 'text-ink/60 hover:bg-black/5 hover:text-ink'
            }`}
          >
            {x.label}
          </button>
        ))}
      </div>
      {/* Switching tabs crossfades the blurb + list (the tab bar stays put). */}
      <ViewTransition key={tab} name="leaderboard-list" share="vt-tab" enter="vt-tab" exit="vt-tab" default="none">
      <div>
      <p className="px-2 pb-1 text-[11px] italic text-ink/55">{t.blurb}</p>
      {entries.length === 0 ? (
        <p className="p-2 text-sm text-ink/70">Nobody qualifies yet — players appear here once they&apos;ve played at least {minHands} hands.</p>
      ) : (
        <ol role="tabpanel" className="text-sm">
          {entries.map((e, i) => {
            const me = e.userId === meId;
            const good = t.good(e);
            return (
              <li key={e.userId} className={`flex items-baseline gap-2 border-b border-dotted border-[#b0a98f] px-2 py-1.5 ${me ? 'bg-brass/10' : ''}`}>
                <span className="w-5 text-right tabular-nums text-ink/50">{i + 1}</span>
                <span className="flex-1 truncate">{e.name}</span>
                <span className="text-[10px] tabular-nums text-ink/45">{t.hint(e)}</span>
                <b className={`w-14 text-right tabular-nums ${good === null ? 'text-walnut' : good ? 'text-sage-deep' : 'text-maroon'}`}>{t.fmt(e)}</b>
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
