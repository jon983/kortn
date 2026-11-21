// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Wordmark, ShopSign, MenuBoard, Ribbon, LeaderLine } from '../deli';

describe('deli building blocks', () => {
  it('Wordmark says KORTN', () => {
    render(<Wordmark />);
    expect(screen.getByText('KORTN')).toBeInTheDocument();
  });
  it('ShopSign greets the player by name', () => {
    render(<ShopSign name="Jonathan" />);
    expect(screen.getByText('Jonathan')).toBeInTheDocument();
    expect(screen.getByText('Good evening,')).toBeInTheDocument();
  });
  it('MenuBoard wraps its children in decorative, hidden art', () => {
    const { container } = render(<MenuBoard><p>menu</p></MenuBoard>);
    expect(screen.getByText('menu')).toBeInTheDocument();
    expect(container.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });
  it('Ribbon renders a banner', () => {
    render(<Ribbon>Your record</Ribbon>);
    expect(screen.getByText('Your record')).toHaveClass('deli-ribbon');
  });
  it('LeaderLine shows label and value, red tone on request', () => {
    render(<LeaderLine label="Net bits" value="+64" tone="red" />);
    expect(screen.getByText('Net bits')).toBeInTheDocument();
    expect(screen.getByText('+64')).toHaveClass('text-deli-red');
  });
});
