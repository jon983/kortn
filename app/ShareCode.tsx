'use client';
import { useState } from 'react';

/** Share a table's code: the phone's share sheet where there is one, otherwise copy it. */
export function ShareCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: 'Join my kortn table', text: `Table code: ${code}` });
        return;
      }
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* share sheet dismissed / clipboard blocked: nothing to do */ }
  }
  return (
    <button type="button" onClick={() => void share()} className="deli-pill deli-pill--outline btn-lift !px-3 !py-1.5 !text-[13px]">
      {copied ? 'Copied!' : 'Share'}
    </button>
  );
}
