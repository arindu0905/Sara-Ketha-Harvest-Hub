import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { BotMascot } from './BotMascot';

/**
 * Floating Saara Ketha Bot in the bottom-right corner. It floats and blinks, waves hello every few seconds
 * and when hovered, and opens the crop advisor when clicked. The speech bubble can be closed.
 */
export const BotLauncher: React.FC<{ onOpen: () => void; title: string; subtitle: string }> = ({ onOpen, title, subtitle }) => {
  const [hover, setHover] = useState(false);
  const [greeting, setGreeting] = useState(false);
  const [bubble, setBubble] = useState(true);

  useEffect(() => {
    let stop: ReturnType<typeof setTimeout> | undefined;
    const wave = () => { setGreeting(true); stop = setTimeout(() => setGreeting(false), 2400); };
    const first = setTimeout(wave, 1200);
    const every = setInterval(wave, 9000);
    return () => { clearTimeout(first); clearInterval(every); if (stop) clearTimeout(stop); };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex items-end gap-1">
      {bubble && (
        <div className="relative mb-14 sm:mb-16 max-w-[190px] bot-pop">
          <button type="button" onClick={onOpen}
            className="block text-left rounded-2xl rounded-br-sm bg-white border border-emerald-100 shadow-xl px-3.5 py-2.5 hover:border-emerald-300 transition-colors">
            <span className="block text-xs font-bold text-emerald-900 leading-tight">{title}</span>
            <span className="block text-[11px] text-emerald-700 mt-0.5">{subtitle}</span>
          </button>
          <button type="button" onClick={() => setBubble(false)} aria-label="Hide message"
            className="absolute -top-2 -left-2 h-5 w-5 rounded-full bg-white border border-surface-200 shadow flex items-center justify-center text-surface-500 hover:text-surface-800">
            <X size={11} />
          </button>
        </div>
      )}
      <button type="button" onClick={onOpen} aria-label={title}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)} onBlur={() => setHover(false)}
        className="w-20 sm:w-24 shrink-0 rounded-3xl transition-transform hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400/50">
        <BotMascot mood={hover || greeting ? 'happy' : 'idle'} className="drop-shadow-xl" />
      </button>
    </div>
  );
};
