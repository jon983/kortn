import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Brand images in the wordmark's own lettering (favicon and home-screen icon,
// drawn at build time; /logo.png). Colours match globals.css.
const GREEN = '#1d5446';
const CREAM = '#f6efdc';

let font: Promise<Buffer> | null = null;
/** Archivo Black, committed in lib/brand (SIL Open Font License, see OFL.txt). */
export function markFont(): Promise<Buffer> {
  return (font ??= readFile(join(process.cwd(), 'lib/brand/ArchivoBlack-Regular.ttf')));
}
const fonts = async () => [{ name: 'Archivo Black', data: await markFont(), weight: 400 as const, style: 'normal' as const }];

/**
 * The favicon: a green K on a cream sign with a green border. Small sizes (the
 * tab) are a rounded tile with a thicker border so it still reads at 32px.
 * Large sizes (the home screen) fill the square, since phones round the corners
 * themselves, with the bordered sign drawn just inside.
 */
export async function iconImage(px: number): Promise<ImageResponse> {
  const small = px < 96;
  const k = <span style={{ fontSize: Math.round(px * (small ? 0.74 : 0.62)), lineHeight: 1, marginTop: Math.round(px * 0.04) }}>K</span>;
  const tile = small ? (
    <div style={{
      width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: CREAM, color: GREEN, fontFamily: 'Archivo Black',
      border: `${Math.max(3, Math.round(px * 0.09))}px solid ${GREEN}`, borderRadius: Math.round(px * 0.2),
    }}>{k}</div>
  ) : (
    <div style={{ width: '100%', height: '100%', display: 'flex', background: CREAM, padding: Math.round(px * 0.07) }}>
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: GREEN, fontFamily: 'Archivo Black',
        border: `${Math.round(px * 0.035)}px solid ${GREEN}`, borderRadius: Math.round(px * 0.14),
      }}>{k}</div>
    </div>
  );
  return new ImageResponse(tile, { width: px, height: px, fonts: await fonts() });
}

/** The green KORTN sign (the logo), sized from its wordmark height `m`. */
function Sign({ m, shadow }: { m: number; shadow: boolean }) {
  return (
    <div style={{
      display: 'flex', background: GREEN, borderRadius: Math.round(m * 0.16), padding: Math.round(m * 0.09),
      boxShadow: shadow ? `0 ${Math.round(m * 0.12)}px ${Math.round(m * 0.3)}px rgba(0,0,0,.45)` : 'none',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: Math.round(m * 0.13), color: CREAM, fontFamily: 'Archivo Black',
        border: `${Math.max(2, Math.round(m * 0.025))}px solid ${CREAM}`, borderRadius: Math.round(m * 0.1),
        padding: `${Math.round(m * 0.18)}px ${Math.round(m * 0.3)}px ${Math.round(m * 0.12)}px`,
      }}>
        <span style={{ fontSize: m, lineHeight: 0.84 }}>KORTN</span>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: Math.round(m * 0.22), lineHeight: 0.9, letterSpacing: m * 0.013 }}>
          <span>THE</span><span>CARD</span><span>TABLE</span>
        </div>
      </div>
    </div>
  );
}

/**
 * The logo on its own, on a transparent background (/logo.png).
 *
 * The link-preview picture (app/opengraph-image.jpg) is this sign over the
 * dining-room photo, rendered once and saved as a JPEG: a generated PNG of a
 * photo is ~1.4 MB, too big for WhatsApp previews.
 */
export async function signImage(width: number, height: number): Promise<ImageResponse> {
  const m = Math.round(Math.min(width / 6.4, height / 1.9));
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Sign m={m} shadow={false} />
      </div>
    ),
    { width, height, fonts: await fonts() },
  );
}
