// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FrontPage } from '../../../app/FrontPage';

describe('FrontPage', () => {
  it('shows the sign, the tagline, both buttons and the closing line', () => {
    render(<FrontPage />);
    expect(screen.getByRole('img', { name: 'KORTN, the card table' })).toBeInTheDocument();
    expect(screen.getByText('Kalooki with the family, wherever they are.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pull up a chair' })).toHaveAttribute('href', '/sign-up');
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in');
    expect(screen.getByText("Video on, kettle on, let's deal.")).toBeInTheDocument();
    expect(screen.getByText('KORTN · Kalooki online')).toBeInTheDocument();
  });
  it('has no how-it-plays section', () => {
    render(<FrontPage />);
    expect(screen.queryByText(/how it plays/i)).toBeNull();
  });
});
