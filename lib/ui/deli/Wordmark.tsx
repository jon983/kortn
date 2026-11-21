/** KORTN, set like an old deli sign, with the small words stacked beside it. */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-mark leading-[.84] ${className}`}>
      <span className="text-[34px] sm:text-[42px]">KORTN</span>
      <span aria-hidden className="text-center text-[9px] tracking-[.06em] sm:text-[10.5px]">THE<br />CARD<br />TABLE</span>
    </span>
  );
}
