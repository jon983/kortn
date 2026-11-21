/** Round profile picture, or the player's initials when there isn't one. */
export function Avatar({ name, src, size = 24, className = '' }: { name: string; src?: string | null; size?: number; className?: string }) {
  const initials = name.trim().split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase() || '?';
  const style = { width: size, height: size };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- remote avatar host; no layout benefit from next/image here
    return <img src={src} alt="" style={style} className={`shrink-0 rounded-full object-cover ring-1 ring-brass/70 ${className}`} />;
  }
  return (
    <span
      aria-hidden
      style={{ ...style, fontSize: Math.max(9, Math.round(size * 0.4)) }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-walnut font-bold text-bone ring-1 ring-brass/70 ${className}`}
    >
      {initials}
    </span>
  );
}
