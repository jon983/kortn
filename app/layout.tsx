import './globals.css';
import { ClerkProvider } from '@clerk/nextjs';
import type { ReactNode } from 'react';
import { displayFont, bodyFont, markFont, condFont, wideFont, scriptFont, sansFont } from '../lib/ui/fonts';

export const metadata = {
  title: 'KORTN',
  description: 'Online Kalooki in the front room',
  icons: {
    icon: '/art/favicon.svg',
    apple: '/art/apple-touch-icon.png',
  },
  openGraph: {
    title: 'KORTN',
    description: 'Online Kalooki in the front room',
    images: ['/art/vercel-avatar.png'],
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
