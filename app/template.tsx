import { ViewTransition, type ReactNode } from 'react';

/**
 * Templates re-mount on every navigation, so this animates page changes only
 * (enter/exit) — never in-page updates like switching a leaderboard tab.
 */
export default function Template({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter="vt-page-in" exit="vt-page-out" default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}
