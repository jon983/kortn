import './globals.css';
import { ClerkProvider } from '@clerk/nextjs';
import type { ReactNode } from 'react';
import { displayFont, bodyFont } from '../lib/ui/fonts';

export const metadata = { title: 'kortn — Kalooki', description: 'Online Kalooki in the front room' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`}>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
