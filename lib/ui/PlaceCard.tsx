export function PlaceCard({ name, subtitle, host, empty }: { name?: string; subtitle?: string; host?: boolean; empty?: boolean }) {
  if (empty) {
    return (
      <div className="rounded-lg p-2 text-center border border-[#cbc4ad] text-[#8a7f66] italic text-xs"
        style={{ background: 'repeating-linear-gradient(45deg,#e3ddca,#e3ddca 6px,#dcd5bf 6px,#dcd5bf 12px)' }}>
        <div className="mx-auto mb-1 h-6 w-6 rounded-full bg-[#cfc7ad]" />
        waiting…
      </div>
    );
  }
  return (
    <div className="rounded-lg p-2 text-center border border-brass bg-[linear-gradient(180deg,#f6efd8,#e9dfbe)] shadow-[0_5px_10px_rgba(0,0,0,.3)]">
      <div className="mx-auto mb-1 h-6 w-6 rounded-full bg-[radial-gradient(circle_at_40%_35%,#8a7a63,#5b4a37)]" />
      <div className="text-[13px] font-bold text-[#4a3320]">{name}</div>
      {host && <div className="text-[8px] uppercase tracking-wider text-maroon">host</div>}
      {subtitle && <div className="text-[10px] text-[#6a6250]">{subtitle}</div>}
    </div>
  );
}
