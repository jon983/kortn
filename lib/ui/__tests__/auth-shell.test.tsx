// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthShell } from '../../../app/(auth)/AuthShell';

describe('AuthShell', () => {
  it('hangs the KORTN sign above the box, with a way back to the front page', () => {
    render(<AuthShell><div data-testid="box" /></AuthShell>);
    const sign = screen.getByRole('img', { name: 'KORTN, the card table' });
    expect(screen.getByRole('link', { name: '← kortn.com' })).toHaveAttribute('href', '/');
    expect(sign.compareDocumentPosition(screen.getByTestId('box')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
