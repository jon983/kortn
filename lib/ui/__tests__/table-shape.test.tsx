// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TableShape } from '../TableShape';

describe('TableShape', () => {
  it('renders one seat slot per seat', () => {
    const { container } = render(<TableShape seats={5} renderSeat={(s) => <span>seat{s}</span>} />);
    expect(container.querySelectorAll('[data-seat]')).toHaveLength(5);
  });
});
