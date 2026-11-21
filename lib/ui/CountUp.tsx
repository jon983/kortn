'use client';
import { useCountUp } from './useCountUp';

/** A number that counts up on arrival, keeping its format (decimals, sign, prefix/suffix). */
export function CountUp({ value, decimals = 0, prefix = '', suffix = '', signed = false }: {
  value: number; decimals?: number; prefix?: string; suffix?: string; signed?: boolean;
}) {
  const n = useCountUp(value);
  // Normalise -0 (a negative target's first frame) so it never shows as "-0".
  const shown = (n === 0 ? 0 : n).toFixed(decimals).replace(/^-(0(\.0+)?)$/, '$1');
  const sign = signed && Number(shown) > 0 ? '+' : '';
  return <>{prefix}{sign}{shown}{suffix}</>;
}
