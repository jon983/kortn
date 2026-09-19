import { DM_Serif_Display, Zilla_Slab } from 'next/font/google';

export const displayFont = DM_Serif_Display({ weight: '400', subsets: ['latin'], variable: '--font-display' });
export const bodyFont = Zilla_Slab({ weight: ['400', '600', '700'], subsets: ['latin'], variable: '--font-body' });
