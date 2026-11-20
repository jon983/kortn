const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const STEPS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['minute', 60], ['hour', 60], ['day', 24], ['week', 7], ['month', 30 / 7], ['year', 12],
];

/** "just now", "5 minutes ago", "yesterday", "2 days ago", "3 weeks ago", … */
export function timeAgo(when: Date, now: Date = new Date()): string {
  let value = (now.getTime() - when.getTime()) / 1000; // seconds
  if (value < 60) return 'just now';
  value /= 60;
  for (let i = 0; i < STEPS.length; i++) {
    const [unit] = STEPS[i];
    const next = STEPS[i + 1];
    if (!next || value < next[1]) return rtf.format(-Math.floor(value), unit);
    value /= next[1];
  }
  return rtf.format(-Math.floor(value), 'year');
}
