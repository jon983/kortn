// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RoomBackdrop } from '../RoomBackdrop';
import { Framed } from '../Framed';
import { PlaceCard } from '../PlaceCard';
import { LampButton } from '../LampButton';

describe('parlour kit', () => {
  it('RoomBackdrop renders children and falls back without a plate', () => {
    render(<RoomBackdrop><p>inside</p></RoomBackdrop>);
    expect(screen.getByText('inside')).toBeInTheDocument();
  });
  it('RoomBackdrop references the plate url when given', () => {
    const { container } = render(<RoomBackdrop plate="room-home"><i>x</i></RoomBackdrop>);
    expect(container.innerHTML).toContain('/art/room-home.jpg');
  });
  it('Framed shows its title', () => {
    render(<Framed title="At the table"><div>rows</div></Framed>);
    expect(screen.getByText('At the table')).toBeInTheDocument();
  });
  it('PlaceCard shows a name, and empty state', () => {
    render(<><PlaceCard name="Ruth" /><PlaceCard empty /></>);
    expect(screen.getByText('Ruth')).toBeInTheDocument();
    expect(screen.getByText(/waiting/i)).toBeInTheDocument();
  });
  it('LampButton forwards onClick/label', () => {
    render(<LampButton>Deal us in</LampButton>);
    expect(screen.getByRole('button', { name: 'Deal us in' })).toBeInTheDocument();
  });
});
