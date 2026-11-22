// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KortnSign } from '../deli/KortnSign';

describe('KortnSign', () => {
  it('is one labelled image reading KORTN, the card table', () => {
    render(<KortnSign />);
    expect(screen.getByRole('img', { name: 'KORTN, the card table' })).toBeInTheDocument();
  });
  it('draws chains only when asked', () => {
    const plain = render(<KortnSign />);
    expect(plain.container.querySelectorAll('[data-chain]')).toHaveLength(0);
    plain.unmount();
    const hung = render(<KortnSign chains />);
    expect(hung.container.querySelectorAll('[data-chain]')).toHaveLength(2);
  });
  it('md is the small size', () => {
    render(<KortnSign size="md" />);
    expect(screen.getByRole('img').getAttribute('data-size')).toBe('md');
  });
});
