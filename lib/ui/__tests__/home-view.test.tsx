// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// The kitchen's live, account and form pieces aren't under test here.
vi.mock('../../../app/KitchenLive', () => ({ KitchenLive: () => null }));
vi.mock('../../../app/HomeHeader', () => ({ HomeHeader: () => null }));
vi.mock('../../../app/JoinPill', () => ({ JoinPill: () => null }));
vi.mock('../../../app/SetTablePill', () => ({ SetTablePill: () => null }));
vi.mock('../../../app/LeaderboardTabs', () => ({ LeaderboardTabs: () => null }));
vi.mock('../deli/RecordList', () => ({ RecordList: () => null }));

import { HomeView } from '../../../app/HomeView';

describe('the kitchen', () => {
  it('has no "pull up a chair" sign-off under the menu card', () => {
    render(<HomeView userId="u1" myName="Ruth" stats={{} as any} boards={{} as any} minHands={10} games={[]} />);
    expect(screen.getByText("Today's tables")).toBeInTheDocument(); // the menu card rendered
    expect(screen.queryByText(/pull up a chair/i)).toBeNull();
    expect(screen.queryByText(/always a seat at the table/i)).toBeNull();
  });
});
