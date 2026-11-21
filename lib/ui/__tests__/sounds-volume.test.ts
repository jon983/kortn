// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';

describe('saved volume', () => {
  it('a player who muted at the table stays muted everywhere', async () => {
    const createOscillator = vi.fn();
    (window as any).AudioContext = class { state = 'running'; currentTime = 0; destination = {}; createOscillator = createOscillator; createGain() { return {}; } };
    vi.stubGlobal('localStorage', { getItem: (k: string) => (k === 'kortn-volume' ? '0' : null) });
    const { loadSavedVolume, playYourTurn } = await import('../table/sounds');
    loadSavedVolume();
    playYourTurn();
    expect(createOscillator).not.toHaveBeenCalled();
  });
});
