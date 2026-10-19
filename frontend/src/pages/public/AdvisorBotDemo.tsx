import React, { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';

/** One scripted conversation. The picks are real crop-advisor results (see landingCopy.ts). */
export interface DemoExample { q: string; why: string; picks: { e: string; name: string; score: number }[] }

type Mood = 'idle' | 'listening' | 'thinking' | 'happy';

/* Timeline of one example, in ms */
const T_QUESTION = 500, T_TYPING = 1500, T_ANSWER = 3000, MS_PER_CHAR = 28, HOLD = 4800, FADE = 450, TICK = 50;
const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

const STYLES = `
@keyframes lhbBob    { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-7px) } }
@keyframes lhbShadow { 0%,100% { transform: scaleX(1); opacity: .28 } 50% { transform: scaleX(.78); opacity: .14 } }
@keyframes lhbBlink  { 0%, 90%, 100% { transform: scaleY(1) } 94% { transform: scaleY(.1) } }
@keyframes lhbSway   { 0%,100% { transform: rotate(-9deg) } 50% { transform: rotate(9deg) } }
@keyframes lhbWave   { 0%,100% { transform: rotate(0) } 25% { transform: rotate(-24deg) } 75% { transform: rotate(14deg) } }
@keyframes lhbTalk   { 0%,100% { transform: scaleY(1) } 50% { transform: scaleY(.35) } }
@keyframes lhbGlow   { 0%,100% { opacity: .15; transform: scale(.8) } 50% { opacity: .9; transform: scale(1.3) } }
@keyframes lhbHop    { 0% { transform: translateY(0) } 30% { transform: translateY(-16px) } 55% { transform: translateY(0) } 70% { transform: translateY(-5px) } 100% { transform: translateY(0) } }
@keyframes lhbTilt   { 0%,100% { transform: rotate(0) } 50% { transform: rotate(-7deg) } }
@keyframes lhbSpark  { 0%,100% { opacity: 0; transform: scale(.3) rotate(0) } 50% { opacity: 1; transform: scale(1) rotate(45deg) } }
@keyframes lhbDot    { 0%, 80%, 100% { transform: translateY(0); opacity: .45 } 40% { transform: translateY(-5px); opacity: 1 } }
@keyframes lhbPop    { 0% { opacity: 0; transform: translateY(8px) scale(.92) } 100% { opacity: 1; transform: none } }
@keyframes lhbCaret  { 50% { opacity: 0 } }
.lhb-bob    { animation: lhbBob 3s ease-in-out infinite; }
.lhb-shadow { transform-box: view-box; transform-origin: 60px 143px; animation: lhbShadow 3s ease-in-out infinite; }
.lhb-blink  { transform-box: view-box; transform-origin: 60px 66px; animation: lhbBlink 4.2s infinite; }
.lhb-sway   { transform-box: view-box; transform-origin: 60px 34px; animation: lhbSway 2.8s ease-in-out infinite; }
.lhb-wave   { transform-box: view-box; transform-origin: 84px 106px; animation: lhbWave 1.1s ease-in-out infinite; }
.lhb-talk   { transform-box: view-box; transform-origin: 60px 80px; animation: lhbTalk .26s ease-in-out infinite; }
.lhb-glow   { transform-box: view-box; transform-origin: 60px 11px; animation: lhbGlow 1s ease-in-out infinite; }
.lhb-hop    { animation: lhbHop .9s cubic-bezier(.3,.7,.3,1) 1; }
.lhb-tilt   { transform-box: view-box; transform-origin: 60px 104px; animation: lhbTilt 1.6s ease-in-out infinite; }
.lhb-spark  { transform-box: fill-box; transform-origin: center; animation: lhbSpark 1.4s ease-in-out infinite; }
.lhb-dot    { animation: lhbDot 1s ease-in-out infinite; }
.lhb-pop    { animation: lhbPop .45s cubic-bezier(.2,.8,.2,1) both; }
.lhb-caret  { animation: lhbCaret .8s step-end infinite; }
@media (prefers-reduced-motion: reduce) {
  .lhb-bob, .lhb-shadow, .lhb-blink, .lhb-sway, .lhb-wave, .lhb-talk, .lhb-glow, .lhb-hop, .lhb-tilt, .lhb-spark, .lhb-dot, .lhb-pop, .lhb-caret { animation: none !important; }
}
`;

const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const on = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
};

const STAR = 'M0 -6 L1.6 -1.6 L6 0 L1.6 1.6 L0 6 L-1.6 1.6 L-6 0 L-1.6 -1.6Z';

/** The Saara Ketha Bot: a small robot with a sprout antenna. */
const Mascot: React.FC<{ mood: Mood; talking: boolean }> = ({ mood, talking }) => {
  const ink = '#065F46', screen = '#064E3B', glow = '#6EE7B7', gold = '#F5B335';
  const happy = mood === 'happy';
  return (
    <svg viewBox="0 0 120 150" className="w-full h-auto overflow-visible drop-shadow-xl">
      <ellipse className="lhb-shadow" cx="60" cy="143" rx="30" ry="5" fill="#000" />
      <g className="lhb-bob">
        <g key={mood} className={happy ? 'lhb-hop' : mood === 'listening' ? 'lhb-tilt' : undefined}>
          {/* sprout antenna */}
          {mood === 'thinking' && <circle className="lhb-glow" cx="60" cy="11" r="11" fill="#FDE68A" />}
          <g className="lhb-sway">
            <path d="M60 34 V16" stroke={ink} strokeWidth="3" strokeLinecap="round" />
            <path d="M60 22 C50 21 45 13 47 5 C56 7 61 13 60 22Z" fill="#34D399" stroke={ink} strokeWidth="1.5" />
            <path d="M60 17 C67 11 74 11 79 15 C73 22 66 23 60 17Z" fill="#10B981" stroke={ink} strokeWidth="1.5" />
          </g>
          {/* ears */}
          <rect x="7" y="56" width="11" height="22" rx="5.5" fill={gold} stroke={ink} strokeWidth="2" />
          <rect x="102" y="56" width="11" height="22" rx="5.5" fill={gold} stroke={ink} strokeWidth="2" />
          {/* head and face screen */}
          <rect x="16" y="34" width="88" height="66" rx="28" fill="#FFFFFF" stroke={ink} strokeWidth="3" />
          <rect x="27" y="45" width="66" height="44" rx="18" fill={screen} />
          <g className="lhb-blink">
            {happy ? (
              <>
                <path d="M40 68 q7 -9 14 0" stroke={glow} strokeWidth="4" strokeLinecap="round" fill="none" />
                <path d="M66 68 q7 -9 14 0" stroke={glow} strokeWidth="4" strokeLinecap="round" fill="none" />
              </>
            ) : (
              <>
                <ellipse cx={mood === 'thinking' ? 50 : 47} cy={mood === 'thinking' ? 62 : 66} rx="5.5" ry="7" fill={glow} />
                <ellipse cx={mood === 'thinking' ? 76 : 73} cy={mood === 'thinking' ? 62 : 66} rx="5.5" ry="7" fill={glow} />
                <circle cx={mood === 'thinking' ? 52 : 49} cy={mood === 'thinking' ? 59 : 63} r="1.8" fill="#fff" />
                <circle cx={mood === 'thinking' ? 78 : 75} cy={mood === 'thinking' ? 59 : 63} r="1.8" fill="#fff" />
              </>
            )}
          </g>
          {talking
            ? <ellipse className="lhb-talk" cx="60" cy="80" rx="5" ry="3.2" fill={glow} />
            : mood === 'thinking'
              ? <path d="M55 81 h10" stroke={glow} strokeWidth="3" strokeLinecap="round" />
              : <path d="M53 78 q7 6 14 0" stroke={glow} strokeWidth="3" strokeLinecap="round" fill="none" />}
          <circle cx="34" cy="80" r="3.5" fill={gold} opacity=".85" />
          <circle cx="86" cy="80" r="3.5" fill={gold} opacity=".85" />
          {/* body with leaf badge */}
          <rect x="36" y="100" width="48" height="34" rx="14" fill={gold} stroke={ink} strokeWidth="2.5" />
          <path d="M60 126 C52 122 52 111 60 106 C68 111 68 122 60 126Z" fill={ink} />
          <path d="M60 124 V110" stroke={gold} strokeWidth="1.5" />
          {/* arms: the right one waves when the bot answers */}
          <path d="M37 108 q-14 4 -16 16" stroke={ink} strokeWidth="6" strokeLinecap="round" fill="none" />
          <circle cx="21" cy="125" r="5.5" fill="#fff" stroke={ink} strokeWidth="2" />
          {happy ? (
            <g className="lhb-wave">
              <path d="M83 108 q14 -4 18 -18" stroke={ink} strokeWidth="6" strokeLinecap="round" fill="none" />
              <circle cx="101" cy="89" r="5.5" fill="#fff" stroke={ink} strokeWidth="2" />
            </g>
          ) : (
            <>
              <path d="M83 108 q14 4 16 16" stroke={ink} strokeWidth="6" strokeLinecap="round" fill="none" />
              <circle cx="99" cy="125" r="5.5" fill="#fff" stroke={ink} strokeWidth="2" />
            </>
          )}
          {happy && [[12, 32, 0], [108, 26, 0.45], [112, 74, 0.9]].map(([x, y, d]) => (
            <path key={`${x}-${y}`} className="lhb-spark" d={STAR} transform={`translate(${x} ${y})`} fill="#FCD34D" style={{ animationDelay: `${d}s` }} />
          ))}
        </g>
      </g>
    </svg>
  );
};

const ScoreRing: React.FC<{ value: number; emoji: string }> = ({ value, emoji }) => {
  const r = 20, c = 2 * Math.PI * r;
  return (
    <div className="relative h-12 w-12 sm:h-14 sm:w-14 shrink-0">
      <svg viewBox="0 0 48 48" className="h-full w-full -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" stroke="#FDE68A" strokeWidth="5" />
        <circle cx="24" cy="24" r={r} fill="none" stroke="#059669" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xl sm:text-2xl">{emoji}</span>
    </div>
  );
};

/** Animated crop-advisor conversation for the landing page. Loops while visible, pauses on hover. */
export const AdvisorBotDemo: React.FC<{ examples: DemoExample[]; label: string; photo: string }> = ({ examples, label, photo }) => {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const [idx, setIdx] = useState(0);
  const [t, setT] = useState(0);
  const [visible, setVisible] = useState(false);
  const [hover, setHover] = useState(false);

  const ex = examples[idx % examples.length];
  const typedEnd = T_ANSWER + ex.why.length * MS_PER_CHAR;
  const end = typedEnd + HOLD;

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => { setIdx(0); setT(0); }, [examples]); // language changed

  useEffect(() => {
    if (reduced || !visible || hover) return;
    const id = setInterval(() => setT((v) => v + TICK), TICK);
    return () => clearInterval(id);
  }, [reduced, visible, hover]);

  useEffect(() => {
    if (t >= end) { setIdx((i) => (i + 1) % examples.length); setT(0); }
  }, [t, end, examples.length]);

  // With reduced motion the finished conversation is shown, without movement.
  const now = reduced ? typedEnd : t;
  const showQ = now >= T_QUESTION;
  const typing = now >= T_TYPING && now < T_ANSWER;
  const showA = now >= T_ANSWER;
  const typed = Math.min(ex.why.length, Math.max(0, Math.floor((now - T_ANSWER) / MS_PER_CHAR)));
  const ring = easeOut((now - T_ANSWER - 200) / 1200);
  const talking = showA && typed < ex.why.length;
  const mood: Mood = showA ? 'happy' : typing ? 'thinking' : showQ ? 'listening' : 'idle';
  const [top, ...rest] = ex.picks;

  return (
    <div ref={ref} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className="relative rounded-3xl overflow-hidden aspect-[4/5] sm:aspect-[4/3] shadow-xl bg-emerald-900">
      <style>{STYLES}</style>
      <img src={photo} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
      <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/90 via-emerald-950/45 to-emerald-950/10" />

      <div className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-emerald-900 shadow">
        <Sparkles size={13} className="text-amber-500" /> {label}
      </div>
      <div className="absolute right-4 top-5 flex gap-1.5">
        {examples.map((_, i) => (
          <button key={i} type="button" aria-label={`Example ${i + 1}`} onClick={() => { setIdx(i); setT(0); }}
            className={`h-2 rounded-full transition-all ${i === idx ? 'w-5 bg-amber-400' : 'w-2 bg-white/60 hover:bg-white'}`} />
        ))}
      </div>

      <div aria-hidden className="absolute inset-x-3 sm:inset-x-5 bottom-3 sm:bottom-5 flex items-end gap-2 sm:gap-3">
        <div className="w-[76px] sm:w-[108px] shrink-0"><Mascot mood={mood} talking={talking} /></div>
        <div className={`flex-1 min-w-0 space-y-2 pb-1 transition-opacity duration-500 ${now > end - FADE ? 'opacity-0' : 'opacity-100'}`}>
          {showQ && (
            <div key={`q${idx}`} className="lhb-pop ml-auto w-fit max-w-[95%] rounded-2xl rounded-br-sm bg-emerald-700 text-white px-3.5 py-2 text-xs sm:text-sm shadow-lg">
              {ex.q}
            </div>
          )}
          {typing && (
            <div className="lhb-pop w-fit rounded-2xl rounded-bl-sm bg-white px-4 py-3 shadow-lg flex gap-1.5">
              {[0, 1, 2].map((i) => <span key={i} className="lhb-dot h-2 w-2 rounded-full bg-emerald-600" style={{ animationDelay: `${i * 0.15}s` }} />)}
            </div>
          )}
          {showA && (
            <div key={`a${idx}`} className="lhb-pop rounded-2xl rounded-bl-sm bg-white text-emerald-950 p-3 sm:p-3.5 shadow-xl">
              <div className="flex items-center gap-3">
                <ScoreRing value={top.score * ring} emoji={top.e} />
                <div className="min-w-0">
                  <div className="font-display font-bold text-sm sm:text-base leading-tight">
                    {top.name} <span className="text-emerald-700">{Math.round(top.score * ring)}/100</span>
                  </div>
                  <div className="text-xs sm:text-[13px] text-emerald-900/80 leading-snug min-h-[2.6em]">
                    {ex.why.slice(0, typed)}{talking && <span className="lhb-caret font-bold text-emerald-600">|</span>}
                  </div>
                </div>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {rest.map((p, k) => (
                  <span key={p.name} className="lhb-pop inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] sm:text-xs font-semibold"
                    style={{ animationDelay: `${0.6 + k * 0.25}s` }}>
                    {p.e} {p.name} <span className="text-emerald-700">{p.score}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="sr-only">{examples[0].q} {examples[0].picks[0].name} {examples[0].picks[0].score}/100. {examples[0].why}</p>
    </div>
  );
};
