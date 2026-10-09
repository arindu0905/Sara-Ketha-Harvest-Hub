import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sprout } from 'lucide-react';

const GREETINGS = ['ආයුබෝවන්', 'வணக்கம்', 'Welcome'];
const GOLD = '#F5B335';

const STYLES = `
@keyframes ahGrad   { 0% { background-position: 0% 50% } 50% { background-position: 100% 50% } 100% { background-position: 0% 50% } }
@keyframes ahBlob1  { 0%, 100% { transform: translate(0,0) scale(1) } 50% { transform: translate(8vw,6vh) scale(1.2) } }
@keyframes ahBlob2  { 0%, 100% { transform: translate(0,0) scale(1) } 50% { transform: translate(-9vw,-5vh) scale(1.15) } }
@keyframes ahRise   { 0% { transform: translateY(0) translateX(0); opacity: 0 } 10% { opacity: var(--o) } 90% { opacity: var(--o) } 100% { transform: translateY(-110vh) translateX(var(--dx)); opacity: 0 } }
@keyframes ahIn     { from { opacity: 0; transform: translateY(40px) scale(.96); filter: blur(8px) } to { opacity: 1; transform: none; filter: none } }
@keyframes ahFade   { 0% { opacity: 0; transform: translateY(8px) } 15%, 85% { opacity: 1; transform: none } 100% { opacity: 0; transform: translateY(-8px) } }
@keyframes ahSpin   { to { transform: rotate(360deg) } }
@keyframes ahWave   { from { transform: translateX(0) } to { transform: translateX(-50%) } }
@keyframes ahBorder { 0% { background-position: 0% 50% } 100% { background-position: 300% 50% } }
@keyframes ahShine  { 0% { transform: translateX(-120%) skewX(-20deg) } 60%, 100% { transform: translateX(260%) skewX(-20deg) } }
@keyframes ahPulse  { 0%, 100% { box-shadow: 0 0 0 0 rgba(245,179,53,.45) } 50% { box-shadow: 0 0 0 14px rgba(245,179,53,0) } }

.ah-bg    { background: linear-gradient(120deg, #022c22, #064e3b, #0b3d3a, #022c22, #14532d); background-size: 300% 300%; animation: ahGrad 24s ease infinite; }
.ah-card  { animation: ahIn .9s cubic-bezier(.2,.7,.2,1) both; transition: transform .25s ease-out; transform-style: preserve-3d; will-change: transform; }
.ah-border { background: linear-gradient(110deg, #F5B335, #34d399, #8D2048, #F5B335, #34d399); background-size: 300% 100%; animation: ahBorder 8s linear infinite; }
.ah-logo  { animation: ahPulse 3s ease-in-out infinite; }

/* Form polish, scoped to the auth card */
.ah-form .form-input { transition: box-shadow .25s ease, transform .25s ease, border-color .25s ease; }
.ah-form .form-input:focus { box-shadow: 0 0 0 3px rgba(16,185,129,.25), 0 8px 20px -10px rgba(5,150,105,.6); transform: translateY(-1px); }
.ah-form .form-label { transition: color .2s ease; }
.ah-form div:focus-within > .form-label, .ah-form div:focus-within > div > .form-label { color: #047857; }
.ah-form .btn-primary { position: relative; overflow: hidden; transition: transform .2s ease, box-shadow .2s ease; }
.ah-form .btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 14px 26px -12px rgba(5,150,105,.8); }
.ah-form .btn-primary:active:not(:disabled) { transform: translateY(0) scale(.99); }
.ah-form .btn-primary::after { content: ''; position: absolute; inset: 0 auto 0 0; width: 40%; background: linear-gradient(90deg, transparent, rgba(255,255,255,.35), transparent); animation: ahShine 3.6s ease-in-out infinite; }
.ah-form .btn-primary:disabled::after { display: none; }

@media (prefers-reduced-motion: reduce) {
  .ah-bg, .ah-card, .ah-border, .ah-logo, .ah-form .btn-primary::after, [data-ah] { animation: none !important; }
  .ah-card { transform: none !important; }
}
`;

/** Drifting golden grains rising from the field, generated once. */
const Grains: React.FC = () => {
  const grains = useMemo(() => Array.from({ length: 22 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    size: 3 + Math.random() * 5,
    dur: 12 + Math.random() * 14,
    delay: -Math.random() * 20,
    dx: (Math.random() - 0.5) * 120,
    o: 0.25 + Math.random() * 0.5,
  })), []);
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {grains.map(g => (
        <span key={g.id} data-ah className="absolute bottom-[-10px] rounded-full"
          style={{ left: `${g.left}%`, width: g.size, height: g.size, background: GOLD, boxShadow: `0 0 ${g.size * 3}px ${GOLD}`,
            ['--o' as any]: g.o, ['--dx' as any]: `${g.dx}px`, animation: `ahRise ${g.dur}s linear ${g.delay}s infinite` }} />
      ))}
    </div>
  );
};

const Lotus: React.FC<{ size: number; className?: string }> = ({ size, className }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" className={className} data-ah style={{ animation: 'ahSpin 90s linear infinite' }} aria-hidden>
    {Array.from({ length: 8 }, (_, i) => (
      <path key={i} d="M50 50 C38 36 38 16 50 6 C62 16 62 36 50 50Z" fill="#fff" opacity={i % 2 ? 0.5 : 0.9} transform={`rotate(${i * 45} 50 50)`} />
    ))}
  </svg>
);

/**
 * Shared animated background + 3D-tilting card for login / register / forgot-password.
 * Children are rendered inside the card.
 */
export const AuthShell: React.FC<{ children: React.ReactNode; wide?: boolean }> = ({ children, wide }) => {
  const card = useRef<HTMLDivElement>(null);
  const [greet, setGreet] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setGreet(g => (g + 1) % GREETINGS.length), 2600);
    return () => clearInterval(id);
  }, []);

  // Subtle tilt that follows the pointer (disabled on touch / reduced motion).
  const onMove = (e: React.MouseEvent) => {
    const el = card.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const x = e.clientX / window.innerWidth - 0.5;
    const y = e.clientY / window.innerHeight - 0.5;
    el.style.transform = `perspective(1100px) rotateY(${x * 7}deg) rotateX(${-y * 7}deg)`;
  };
  const onLeave = () => { if (card.current) card.current.style.transform = ''; };

  return (
    <div className="ah-bg relative min-h-screen flex items-center justify-center px-4 py-12 overflow-hidden" onMouseMove={onMove} onMouseLeave={onLeave}>
      <style>{STYLES}</style>

      {/* aurora blobs */}
      <div className="absolute -top-32 -left-32 h-[28rem] w-[28rem] rounded-full blur-3xl opacity-40 pointer-events-none" data-ah style={{ background: '#10b981', animation: 'ahBlob1 18s ease-in-out infinite' }} />
      <div className="absolute -bottom-40 -right-24 h-[30rem] w-[30rem] rounded-full blur-3xl opacity-30 pointer-events-none" data-ah style={{ background: GOLD, animation: 'ahBlob2 22s ease-in-out infinite' }} />
      <div className="absolute top-1/3 left-1/2 h-72 w-72 rounded-full blur-3xl opacity-20 pointer-events-none" data-ah style={{ background: '#8D2048', animation: 'ahBlob1 26s ease-in-out infinite reverse' }} />

      <Lotus size={520} className="absolute -left-48 top-1/2 -translate-y-1/2 opacity-[0.05] pointer-events-none" />
      <Lotus size={340} className="absolute -right-32 -top-24 opacity-[0.06] pointer-events-none" />
      <Grains />

      {/* paddy waves */}
      <div className="absolute bottom-0 left-0 right-0 h-20 overflow-hidden pointer-events-none" aria-hidden>
        <svg viewBox="0 0 2400 100" preserveAspectRatio="none" className="absolute bottom-0 h-full w-[200%]" data-ah style={{ animation: 'ahWave 36s linear infinite' }}>
          <path d="M0 55 Q150 5 300 55 T600 55 T900 55 T1200 55 T1500 55 T1800 55 T2100 55 T2400 55 V100 H0Z" fill="rgba(245,179,53,0.12)" />
        </svg>
      </div>

      <div className={`relative w-full ${wide ? 'max-w-lg' : 'max-w-md'}`}>
        <div className="text-center mb-7">
          <div className="h-7 overflow-hidden mb-2">
            <div key={greet} className="font-display font-bold text-lg" data-ah style={{ color: GOLD, animation: 'ahFade 2.6s ease both' }}>{GREETINGS[greet]}</div>
          </div>
          <Link to="/" className="inline-flex items-center gap-3 group">
            <div className="ah-logo w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(135deg, #059669 0%, #0d9488 100%)' }}>
              <Sprout size={26} className="text-amber-300 group-hover:rotate-12 transition-transform" />
            </div>
            <div className="text-left">
              <p className="text-xl font-bold text-white font-display leading-tight">Saara Ketha</p>
              <p className="text-xs text-emerald-300/80">Harvest Hub Platform</p>
            </div>
          </Link>
        </div>

        <div ref={card} className="ah-card">
          <div className="ah-border rounded-[26px] p-[1.5px] shadow-2xl">
            <div className="ah-form glass rounded-3xl shadow-modal p-8">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
