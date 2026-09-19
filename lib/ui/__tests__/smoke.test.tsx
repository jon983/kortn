// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

function Hello() { return <div>shalom</div>; }

describe('rtl smoke', () => {
  it('renders a component in jsdom', () => {
    render(<Hello />);
    expect(screen.getByText('shalom')).toBeInTheDocument();
  });
});
