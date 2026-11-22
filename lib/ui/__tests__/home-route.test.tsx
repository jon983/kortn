// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const session = { userId: null as string | null };
vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: session.userId }),
  currentUser: async () => ({ username: 'ruth', hasImage: false }),
}));
vi.mock('../../../app/HomeView', () => ({ HomeView: () => <p>kitchen</p> }));
vi.mock('../../db', () => ({
  db: {},
  upsertUser: async () => {},
  listMatchesForUser: async () => [],
  getHandAggregates: async () => new Map(),
  getUserStats: async () => ({}),
  leaderboardsFrom: () => ({}),
  listPlayersWithNames: async () => [],
  loadGameState: async () => null,
}));

import Home from '../../../app/page';


describe('/', () => {
  it('signed out: the front page', async () => {
    session.userId = null;
    render(await Home());
    expect(screen.getByRole('img', { name: 'KORTN, the card table' })).toBeInTheDocument();
  });
  it('signed in: the kitchen, never the front page', async () => {
    session.userId = 'u1';
    render(await Home());
    expect(screen.getByText('kitchen')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'KORTN, the card table' })).toBeNull();
  });
});
