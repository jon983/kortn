// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FrontPage } from '../../../app/FrontPage';

describe('FrontPage', () => {
  it('shows just the sign, the buttons and the footer', () => {
    render(<FrontPage />);
    expect(screen.getByRole('img', { name: 'KORTN, the card table' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/sign-up');
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in');
    expect(screen.getByText('KORTN · Kalooki online')).toBeInTheDocument();
  });
  it('has no tagline or closing line', () => {
    render(<FrontPage />);
    expect(screen.queryByText(/wherever they are/i)).toBeNull();
    expect(screen.queryByText(/kettle on/i)).toBeNull();
  });
  it('has no how-it-plays section', () => {
    render(<FrontPage />);
    expect(screen.queryByText(/how it plays/i)).toBeNull();
  });
});
