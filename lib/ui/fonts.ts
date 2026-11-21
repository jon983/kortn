import { DM_Serif_Display, Zilla_Slab, Archivo_Black, Big_Shoulders, Archivo, Yesteryear, Jost } from 'next/font/google';

export const displayFont = DM_Serif_Display({ weight: '400', subsets: ['latin'], variable: '--font-display' });
export const bodyFont = Zilla_Slab({ weight: ['400', '600', '700'], subsets: ['latin'], variable: '--font-body' });

/* ── The corner-deli look (kitchen first; other pages later) ── */
/** Heavy wordmark: KORTN. */
export const markFont = Archivo_Black({ weight: '400', subsets: ['latin'], variable: '--nf-mark' });
/** Condensed shop-sign capitals: names, numbers, buttons. */
export const condFont = Big_Shoulders({ weight: ['700', '800', '900'], subsets: ['latin'], variable: '--nf-cond' });
/** Wide, letter-spaced capitals: ribbon banners and small labels (expanded width axis). */
export const wideFont = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--nf-wide' });
/** Sign-writer script accents. */
export const scriptFont = Yesteryear({ weight: '400', subsets: ['latin'], variable: '--nf-script' });
/** Clean small print. */
export const sansFont = Jost({ weight: ['400', '500', '600'], subsets: ['latin'], variable: '--nf-sans' });
