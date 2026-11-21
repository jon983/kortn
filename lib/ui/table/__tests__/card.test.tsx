// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, rankLabel } from '../Card';
import { CardBack } from '../CardBack';
import type { Card as CardT } from '../../../kalooki';

const c = (rank: number, suit: string, pack = 'A'): CardT =>
  ({ id: `${pack}-${suit}-${rank}`, kind: 'natural', rank: rank as any, suit: suit as any, pack: pack as any });

describe('Card', () => {
  it('renders rank label and suit; ace/king map correctly', () => {
    expect(rankLabel(14 as any)).toBe('A');
    expect(rankLabel(13 as any)).toBe('K');
    expect(rankLabel(7 as any)).toBe('7');
    render(<Card card={c(14, 'hearts')} />);
    // rank + suit appear in the corner index/indices and the centre pip
    expect(screen.getAllByText('A').length).toBeGreaterThan(0);
    expect(screen.getAllByText('♥').length).toBeGreaterThan(0);
  });
  it('marks a joker distinctly', () => {
    render(<Card card={{ id: 'A-joker', kind: 'joker', pack: 'A' } as any} />);
    expect(screen.getByText(/joker/i)).toBeInTheDocument();
  });
  it('CardBack draws pack A in deli green and pack B in tomato red', () => {
    const { container } = render(<><CardBack pack="A" /><CardBack pack="B" /></>);
    expect(container.querySelector('[data-pack="A"] svg [fill="#1d5446"]')).not.toBeNull();
    expect(container.querySelector('[data-pack="B"] svg [fill="#c8402f"]')).not.toBeNull();
  });
  it('CardBack carries the K monogram and no image url', () => {
    const { container } = render(<CardBack pack="A" />);
    expect(container.innerHTML).not.toContain('card-back-');
    expect(container.querySelector('svg')!.textContent).toContain('K');
  });
  it('two CardBacks do not share pattern ids', () => {
    const { container } = render(<><CardBack pack="A" /><CardBack pack="A" size="sm" /></>);
    const ids = [...container.querySelectorAll('pattern')].map((p) => p.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });
});
