'use client';
import { useEffect, useRef, useState } from 'react';
import { sendChatAction } from '../../../app/actions/chat';
import type { ChatLine } from './useMatchStream';

const QUICK = ['👍', 'Nice!', 'Your turn', 'Good game'];

export function ChatPanel({
  matchId, chat, seatNames, mySeat, open, onClose,
}: {
  matchId: string; chat: ChatLine[]; seatNames: string[]; mySeat: number;
  open: boolean; onClose: () => void;
}) {
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

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

  if (!open) return null;

  return (
    <div className="absolute right-3 top-14 z-40">
      {/* A cream order slip: script heading, green bubbles for you, cream for everyone else. */}
      <div className="deli-paper flex h-80 w-72 max-w-[85vw] flex-col rounded-md text-deli-green shadow-2xl">
          <div className="flex items-baseline justify-between border-b-2 border-deli-red/70 px-3 pb-1 pt-2">
            <span className="font-script text-[22px] leading-none text-deli-red">Table talk</span>
            <button type="button" onClick={onClose} className="font-script text-[17px] text-deli-green/70 hover:text-deli-red hover:underline">close</button>
          </div>
          <div ref={listRef} className="flex-1 space-y-1.5 overflow-y-auto px-3 py-2 font-sans-deli text-sm">
            {chat.length === 0 && <p className="font-script text-[17px] text-deli-green/70">No messages yet — say hello.</p>}
            {chat.map((m) => {
              const mine = m.seat === mySeat;
              return (
                <div key={m.id} className={mine ? 'text-right' : 'text-left'}>
                  <div className="font-cond text-[11px] font-extrabold uppercase tracking-[.1em] opacity-70">{mine ? 'You' : seatNames[m.seat] ?? `Seat ${m.seat}`}</div>
                  <div className={`inline-block max-w-[85%] break-words rounded-xl px-2.5 py-1 shadow-sm ${mine ? 'bg-deli-green text-deli-cream' : 'bg-white/70 text-deli-green ring-1 ring-deli-green/15'}`}>{m.body}</div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-1 border-t border-dashed border-deli-green/30 px-2 py-1.5">
            {QUICK.map((q) => (
              <button key={q} type="button" onClick={() => send(q)} className="font-cond rounded-full border border-deli-green/50 px-2 py-0.5 text-[12px] font-bold uppercase tracking-[.06em] hover:bg-deli-green/10">{q}</button>
            ))}
          </div>
          <form className="flex gap-2 border-t border-dashed border-deli-green/30 p-2" onSubmit={(e) => { e.preventDefault(); send(text); }}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={300}
              placeholder="Say something…"
              className="min-w-0 flex-1 rounded-full border-2 border-deli-green/40 bg-white/70 px-3 py-1 font-sans-deli text-sm text-deli-green placeholder:text-deli-green/45 focus:border-deli-green focus:outline-none"
            />
            <button type="submit" className="deli-pill deli-pill--green btn-lift !px-3.5 !py-1.5 !text-[13px]">Send</button>
          </form>
      </div>
    </div>
  );
}
