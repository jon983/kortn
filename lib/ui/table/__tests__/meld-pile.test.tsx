// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MeldPile } from '../MeldPile';

const nat = (rank: number) => ({ id: `A-hearts-${rank}`, kind: 'natural', rank, suit: 'hearts', pack: 'A' }) as any;

describe('MeldPile', () => {
  it('a meld settles in when it lands', () => {
    const { container } = render(<MeldPile meld={{ id: 'm1', kind: 'run', ownerSeat: 0, cards: [nat(4), nat(5), nat(6)] } as any} />);
    expect(container.querySelector('[data-meld]')!.className).toContain('meld-land');
  });
});
