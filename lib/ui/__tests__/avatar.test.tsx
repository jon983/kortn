// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Avatar } from '../Avatar';

describe('Avatar', () => {
  it('shows the picture when there is one', () => {
    const { container } = render(<Avatar name="Rosemary Clooney" src="https://img/r.png" />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://img/r.png');
  });
  it('falls back to initials', () => {
    const { container } = render(<Avatar name="Rosemary Clooney" />);
    expect(container.textContent).toBe('RC');
  });
});
