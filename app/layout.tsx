import './globals.css';
import { ClerkProvider } from '@clerk/nextjs';
import type { ReactNode } from 'react';
import { displayFont, bodyFont, markFont, condFont, wideFont, scriptFont, sansFont } from '../lib/ui/fonts';

// The favicon, home-screen icon and link-preview picture come from app/icon.tsx,
// app/apple-icon.tsx and app/opengraph-image.tsx (drawn in lib/brand/images.tsx).
export const metadata = {
  metadataBase: new URL('https://www.kortn.com'),
  title: 'KORTN',
  description: 'Kalooki with the family, wherever they are.',
  openGraph: {
    title: 'KORTN',
    description: 'Kalooki with the family, wherever they are.',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className={[displayFont, bodyFont, markFont, condFont, wideFont, scriptFont, sansFont].map((f) => f.variable).join(' ')}>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
