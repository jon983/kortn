// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CreateForm } from '../../../app/create/CreateForm';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe('CreateForm', () => {
  it('offers seat options 2..5 and defaults to 4', () => {
    render(<CreateForm />);
    for (const n of [2, 3, 4, 5]) expect(screen.getByRole('button', { name: new RegExp(`^${n}$`) })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^4$/ })).toHaveAttribute('aria-pressed', 'true');
  });
  it('lets you pick a different seat count', () => {
    render(<CreateForm />);
    fireEvent.click(screen.getByRole('button', { name: /^5$/ }));
    expect(screen.getByRole('button', { name: /^5$/ })).toHaveAttribute('aria-pressed', 'true');
  });
});
