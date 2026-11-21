import type { ReactNode } from 'react';

/** Small line icons (stroke = currentColor), drawn to match the video-call icons in the header. */
function LineIcon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden className="block">
      {children}
    </svg>
  );
}

export const ChatIcon = () => (
  <LineIcon><path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-9l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" /></LineIcon>
);

/** Speaker: two waves at full volume, one when low, a cross when muted. */
export const SpeakerIcon = ({ volume }: { volume: number }) => (
  <LineIcon>
    <path d="M4 9h4l5-4v14l-5-4H4z" />
    {volume === 0 ? <path d="m17 9 5 6M22 9l-5 6" /> : <path d="M16.5 9.5a3.5 3.5 0 0 1 0 5" />}
    {volume >= 0.5 && <path d="M19 7a7 7 0 0 1 0 10" />}
  </LineIcon>
);

export const ScoresIcon = () => (
  <LineIcon><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></LineIcon>
);

/** Two arrows chasing round: reload the table. */
export const RefreshIcon = () => (
  <LineIcon><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" /><path d="M4 3v5h5" /><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" /><path d="M20 21v-5h-5" /></LineIcon>
);
