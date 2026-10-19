import React, { useEffect } from 'react';

/** idle: floats and blinks · listening: leans in · thinking: glowing antenna, eyes up · happy: hops, waves, sparkles */
export type BotMood = 'idle' | 'listening' | 'thinking' | 'happy';

const STYLE_ID = 'bot-mascot-styles';
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
@media (prefers-reduced-motion: reduce) {
  .lhb-bob, .lhb-shadow, .lhb-blink, .lhb-sway, .lhb-wave, .lhb-talk, .lhb-glow, .lhb-hop, .lhb-tilt, .lhb-spark { animation: none !important; }
}
`;

/** Adds the mascot's animation CSS to the page once, however many mascots are on screen. */
const useMascotStyles = () => {
  useEffect(() => {
    if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = STYLES;
    document.head.appendChild(el);
  }, []);
};

const STAR = 'M0 -6 L1.6 -1.6 L6 0 L1.6 1.6 L0 6 L-1.6 1.6 L-6 0 L-1.6 -1.6Z';

/** The Saara Ketha Bot: a small robot with a sprout antenna. Scales to the width of its container. */
export const BotMascot: React.FC<{ mood?: BotMood; talking?: boolean; shadow?: boolean; className?: string }> = ({
  mood = 'idle', talking = false, shadow = true, className = '',
}) => {
  useMascotStyles();
  const ink = '#065F46', screen = '#064E3B', glow = '#6EE7B7', gold = '#F5B335';
  const happy = mood === 'happy';
  const thinking = mood === 'thinking';
  return (
    <svg viewBox="0 0 120 150" className={`w-full h-auto overflow-visible ${className}`} aria-hidden>
      {shadow && <ellipse className="lhb-shadow" cx="60" cy="143" rx="30" ry="5" fill="#000" />}
      <g className="lhb-bob">
        <g key={mood} className={happy ? 'lhb-hop' : mood === 'listening' ? 'lhb-tilt' : undefined}>
          {/* sprout antenna */}
          {thinking && <circle className="lhb-glow" cx="60" cy="11" r="11" fill="#FDE68A" />}
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
                <ellipse cx={thinking ? 50 : 47} cy={thinking ? 62 : 66} rx="5.5" ry="7" fill={glow} />
                <ellipse cx={thinking ? 76 : 73} cy={thinking ? 62 : 66} rx="5.5" ry="7" fill={glow} />
                <circle cx={thinking ? 52 : 49} cy={thinking ? 59 : 63} r="1.8" fill="#fff" />
                <circle cx={thinking ? 78 : 75} cy={thinking ? 59 : 63} r="1.8" fill="#fff" />
              </>
            )}
          </g>
          {talking
            ? <ellipse className="lhb-talk" cx="60" cy="80" rx="5" ry="3.2" fill={glow} />
            : thinking
              ? <path d="M55 81 h10" stroke={glow} strokeWidth="3" strokeLinecap="round" />
              : <path d="M53 78 q7 6 14 0" stroke={glow} strokeWidth="3" strokeLinecap="round" fill="none" />}
          <circle cx="34" cy="80" r="3.5" fill={gold} opacity=".85" />
          <circle cx="86" cy="80" r="3.5" fill={gold} opacity=".85" />
          {/* body with leaf badge */}
          <rect x="36" y="100" width="48" height="34" rx="14" fill={gold} stroke={ink} strokeWidth="2.5" />
          <path d="M60 126 C52 122 52 111 60 106 C68 111 68 122 60 126Z" fill={ink} />
          <path d="M60 124 V110" stroke={gold} strokeWidth="1.5" />
          {/* arms: the right one waves when the bot is happy */}
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
