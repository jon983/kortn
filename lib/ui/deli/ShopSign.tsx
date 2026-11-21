/** The cream shop sign hanging on brass chains, greeting the player. */
export function ShopSign({ name, greeting = 'Good evening,', tagline = 'Card sharp · Est. 2026', className = '' }: {
  name: string; greeting?: string; tagline?: string; className?: string;
}) {
  const chain = 'absolute top-0 h-[34px] w-[2px] bg-[repeating-linear-gradient(180deg,#c9a24b_0_5px,#8a6a2a_5px_7px)]';
  return (
    <div className={`relative flex justify-center pt-[32px] ${className}`}>
      <span aria-hidden className={`${chain} left-[calc(50%-34%)] sm:left-[calc(50%-170px)]`} />
      <span aria-hidden className={`${chain} right-[calc(50%-34%)] sm:right-[calc(50%-170px)]`} />
      <div className="deli-paper deli-swing relative w-[88%] max-w-[460px] rounded-2xl px-6 pb-4 pt-[18px] text-center shadow-[0_18px_36px_rgba(0,0,0,.4)]
        before:pointer-events-none before:absolute before:inset-[7px] before:rounded-[10px] before:border-2 before:border-deli-green
        after:pointer-events-none after:absolute after:inset-[11px] after:rounded-[7px] after:border after:border-deli-green/45">
        <div className="font-script text-[26px] leading-none text-deli-red sm:text-[30px]">{greeting}</div>
        <div className="break-words font-cond text-[clamp(34px,10vw,64px)] font-black uppercase leading-[.9] text-deli-green">{name}</div>
        <div className="mt-1.5 font-wide text-[10px] font-extrabold uppercase tracking-[.3em] text-deli-green [font-stretch:125%]">{tagline}</div>
      </div>
    </div>
  );
}
