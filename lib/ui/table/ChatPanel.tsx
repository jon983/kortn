'use client';
import { useEffect, useRef, useState } from 'react';
import { sendChatAction } from '../../../app/actions/chat';
import type { ChatLine } from './useMatchStream';

const QUICK = ['👍', 'Nice!', 'Your turn', 'Good game'];

export function ChatPanel({
  matchId, chat, seatNames, mySeat,
}: {
  matchId: string; chat: ChatLine[]; seatNames: string[]; mySeat: number;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [unread, setUnread] = useState(0);
  const seen = useRef(chat.length);
  const listRef = useRef<HTMLDivElement>(null);

  // Track unread while closed; clear when opened.
  useEffect(() => {
    if (open) { seen.current = chat.length; setUnread(0); }
    else setUnread(chat.length - seen.current);
  }, [chat.length, open]);

  // Keep the newest message in view.
  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [chat.length, open]);

  async function send(body: string) {
    const t = body.trim();
    if (!t) return;
    setText('');
    await sendChatAction(matchId, t);
  }

  return (
    <div className="absolute right-3 top-14 z-40 flex flex-col items-end">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-full border-2 border-brass bg-[#2a1c12] px-4 py-2 text-sm font-bold text-brass shadow-lg hover:bg-brass/10"
      >
        💬 Chat
        {!open && unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-maroon px-1 text-[10px] font-bold text-bone">{unread}</span>
        )}
      </button>
      {open && (
        <div className="mt-2 flex h-80 w-72 max-w-[85vw] flex-col rounded-lg border-2 border-brass bg-[#2a1c12] shadow-2xl">
          <div className="flex items-center justify-between border-b border-brass/30 px-3 py-1.5">
            <span className="text-sm font-bold text-brass">Table talk</span>
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-[#c9b48a] hover:text-bone">✕</button>
          </div>
          <div ref={listRef} className="flex-1 space-y-1.5 overflow-y-auto px-3 py-2 text-sm">
            {chat.length === 0 && <p className="text-xs italic text-[#c9b48a]">No messages yet — say hello.</p>}
            {chat.map((m) => {
              const mine = m.seat === mySeat;
              return (
                <div key={m.id} className={mine ? 'text-right' : 'text-left'}>
                  <div className="text-[10px] uppercase tracking-wide text-[#c9b48a]">{mine ? 'You' : seatNames[m.seat] ?? `Seat ${m.seat}`}</div>
                  <div className={`inline-block max-w-[85%] break-words rounded-lg px-2 py-1 ${mine ? 'bg-[linear-gradient(180deg,#6b4a30,#402c1a)]' : 'bg-black/30'} text-bone`}>{m.body}</div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-1 border-t border-brass/30 px-2 py-1.5">
            {QUICK.map((q) => (
              <button key={q} type="button" onClick={() => send(q)} className="rounded-full border border-brass/50 px-2 py-0.5 text-xs text-brass hover:bg-brass/10">{q}</button>
            ))}
          </div>
          <form className="flex gap-2 border-t border-brass/30 p-2" onSubmit={(e) => { e.preventDefault(); send(text); }}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={300}
              placeholder="Say something…"
              className="min-w-0 flex-1 rounded-md border border-brass/40 bg-black/30 px-2 py-1 text-sm text-bone placeholder:text-[#c9b48a]/60 focus:outline-none"
            />
            <button type="submit" className="rounded-md border-2 border-walnut-dark bg-[linear-gradient(180deg,#6b4a30,#402c1a)] px-3 text-sm font-bold text-bone">Send</button>
          </form>
        </div>
      )}
    </div>
  );
}
