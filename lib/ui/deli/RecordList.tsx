'use client';
import { useState } from 'react';
import type { UserStats } from '../../db';
import { CountUp } from '../CountUp';
import { LeaderLine } from './LeaderLine';

/** Your record as deli menu lines; the less-used numbers sit behind "More…". */
export function RecordList({ stats }: { stats: UserStats }) {
  const [more, setMore] = useState(false);
  if (stats.gamesPlayed === 0 && stats.roundsWon === 0) {
    return <p className="px-1 py-3 font-sans-deli text-sm text-deli-green/75">No games played yet — your record will fill in as you play.</p>;
  }
  const pct = Math.round(stats.winRate * 100);
  return (
    <div className="pt-3">
      <LeaderLine label="Win rate" value={<CountUp value={pct} suffix="%" />} sub={`${stats.gamesWon} of ${stats.gamesPlayed} games`} />
      <LeaderLine label="Hands vs par" value={stats.vsPar == null ? '—' : <CountUp value={stats.vsPar} decimals={2} suffix="×" />} />
      <LeaderLine label="Points a hand" value={stats.avgPointsPerRound == null ? '—' : <CountUp value={stats.avgPointsPerRound} decimals={1} />} />
      <LeaderLine label="Net bits" value={<CountUp value={stats.netBits} signed />} tone={stats.netBits < 0 ? 'red' : 'default'} />
      <LeaderLine label="Kalookis" value={<CountUp value={stats.kalookis} />} />
      {more && (
        <>
          <LeaderLine label="Games played" value={<CountUp value={stats.gamesPlayed} />} />
          <LeaderLine label="Games won" value={<CountUp value={stats.gamesWon} />} />
          <LeaderLine label="Hands won" value={<CountUp value={stats.roundsWon} />} />
          <LeaderLine label="Treasures" value={<CountUp value={stats.treasures} />} />
          <LeaderLine label="Pot winnings" value={<CountUp value={stats.potWinnings} />} sub="bits" />
        </>
      )}
      <button type="button" onClick={() => setMore((m) => !m)} className="mt-1 font-script text-[19px] text-deli-red hover:underline">
        {more ? 'Less…' : 'More…'}
      </button>
    </div>
  );
}
