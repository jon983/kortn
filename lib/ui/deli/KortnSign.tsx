import type { ReactElement } from 'react';

/** Brass chain link pattern, as on the kitchen's ShopSign. */
const CHAIN = 'absolute top-0 w-[2px] bg-[repeating-linear-gradient(180deg,#c9a24b_0_5px,#8a6a2a_5px_7px)]';

const SIZES = {
  // Front page: the big sign hanging from the top of the screen; shrinks to fit phones.
  lg: {
    pad: 'px-[clamp(20px,5vw,48px)] pt-[clamp(14px,3vw,26px)] pb-[clamp(11px,2.4vw,20px)] [outline-offset:-8px] rounded-xl',
    mark: 'text-[clamp(46px,13vw,96px)]',
    stack: 'text-[clamp(10px,2.85vw,21px)]',
    gap: 'gap-[clamp(6px,1.4vw,12px)]',
    chain: 'h-[clamp(36px,9vh,96px)]',
    hang: 'pt-[clamp(36px,9vh,96px)]',
  },
  // Above the sign-in box.
  md: {
    pad: 'px-[22px] pt-[12px] pb-[9px] [outline-offset:-6px] rounded-[10px]',
    mark: 'text-[34px]',
    stack: 'text-[8px]',
    gap: 'gap-[7px]',
    chain: 'h-[28px]',
    hang: 'pt-[28px]',
  },
} as const;

/**
 * The KORTN logo: the wordmark (KORTN, with THE / CARD / TABLE stacked beside
 * it) in cream on a green sign with a cream inner outline. Optionally hung on
 * two brass chains.
 */
export function KortnSign({ size = 'lg', chains = false, className = '' }: {
  size?: 'lg' | 'md'; chains?: boolean; className?: string;
}): ReactElement {
  const s = SIZES[size];
  return (
    <div
      data-kortn-sign
      data-size={size}
      role="img"
      aria-label="KORTN, the card table"
      className={`relative inline-flex flex-col items-center ${chains ? s.hang : ''} ${className}`}
    >
      {chains && (
        <>
          <span aria-hidden data-chain className={`${CHAIN} ${s.chain} left-[18%]`} />
          <span aria-hidden data-chain className={`${CHAIN} ${s.chain} right-[18%]`} />
        </>
      )}
      <div
        aria-hidden
        className={`flex items-center bg-deli-green font-mark leading-[.84] text-deli-cream shadow-[0_12px_30px_rgba(0,0,0,.45)] [outline:2px_solid_var(--color-deli-cream)] ${s.pad} ${s.gap}`}
      >
        <span className={s.mark}>KORTN</span>
        <span className={`text-center tracking-[.06em] ${s.stack}`}>THE<br />CARD<br />TABLE</span>
      </div>
    </div>
  );
}
