import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Sprout, UserPlus, Scale, ClipboardCheck, Banknote, Tractor, ShoppingBasket, Bot, CheckCircle2 } from 'lucide-react';
import { pricesApi } from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatCategoryForLanguage } from '../../utils/categoryUtils';
import { COPY, CROPS, GREETINGS } from './landingCopy';

/* Photography: Unsplash (free licence). Everything degrades to plain colour if the CDN is unreachable. */
const photo = (id: string, w: number) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`;
const IMG = { hero: '1574943320219-553eb213f72d', spices: '1596040033229-a9821ebd058d', rows: '1625246333195-78d9c38ad449' };

const GOLD = '#F5B335';
const MAROON = '#8D2048';

/* ─── Scoped animations (respect reduced motion) ─────────────────────────────── */
const STYLES = `
@keyframes lhKen   { from { transform: scale(1) translateY(0) } to { transform: scale(1.12) translateY(-1.5%) } }
@keyframes lhRise  { from { opacity: 0; transform: translateY(26px) } to { opacity: 1; transform: none } }
@keyframes lhFade  { 0% { opacity: 0; transform: translateY(10px) } 15%, 85% { opacity: 1; transform: none } 100% { opacity: 0; transform: translateY(-10px) } }
@keyframes lhMarq  { from { transform: translateX(0) } to { transform: translateX(-50%) } }
@keyframes lhWave  { from { transform: translateX(0) } to { transform: translateX(-50%) } }
@keyframes lhBob   { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-10px) } }
@keyframes lhSun   { 0%, 100% { transform: scale(1); opacity: .55 } 50% { transform: scale(1.18); opacity: .8 } }
@keyframes lhDraw  { from { transform: scaleX(0) } to { transform: scaleX(1) } }
@keyframes lhSpin  { to { transform: rotate(360deg) } }
.lh-rise  { opacity: 0; animation: lhRise .9s cubic-bezier(.2,.7,.2,1) forwards; }
.lh-reveal { opacity: 0; transform: translateY(30px); transition: opacity .8s ease, transform .8s cubic-bezier(.2,.7,.2,1); transition-delay: var(--d, 0s); }
.lh-reveal.in { opacity: 1; transform: none; }
.lh-card  { transition: transform .35s ease, box-shadow .35s ease; }
.lh-card:hover { transform: translateY(-6px); box-shadow: 0 18px 40px -18px rgba(20,83,45,.45); }
.lh-line  { transform-origin: left; transform: scaleX(0); animation: lhDraw 1.6s .4s ease forwards; }
@media (prefers-reduced-motion: reduce) {
  .lh-rise, .lh-reveal { opacity: 1 !important; transform: none !important; animation: none !important; transition: none !important; }
  .lh-line { transform: none !important; animation: none !important; }
  [data-lh-anim] { animation: none !important; }
}
`;

/** Fades children in when they scroll into view. */
const Reveal: React.FC<{ children: React.ReactNode; delay?: number; className?: string }> = ({ children, delay = 0, className = '' }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={`lh-reveal ${seen ? 'in' : ''} ${className}`} style={{ ['--d' as any]: `${delay}s` }}>{children}</div>;
};

/** A simple eight-petal lotus, used as a Sri Lankan motif. */
const Lotus: React.FC<{ size?: number; color?: string; spin?: boolean; className?: string }> = ({ size = 120, color = 'currentColor', spin, className }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" className={className} data-lh-anim style={spin ? { animation: 'lhSpin 60s linear infinite' } : undefined} aria-hidden>
    {Array.from({ length: 8 }, (_, i) => (
      <path key={i} d="M50 50 C38 36 38 16 50 6 C62 16 62 36 50 50Z" fill={color} opacity={i % 2 ? 0.55 : 0.9} transform={`rotate(${i * 45} 50 50)`} />
    ))}
    <circle cx="50" cy="50" r="5" fill={GOLD} />
  </svg>
);

const Marquee: React.FC = () => {
  const items = [...CROPS, ...CROPS];
  return (
    <div className="overflow-hidden border-y border-amber-200/70 bg-white/70 py-3" aria-hidden>
      <div className="flex w-max gap-10 whitespace-nowrap text-sm font-medium text-emerald-900" data-lh-anim style={{ animation: 'lhMarq 50s linear infinite' }}>
        {items.map(([e, en, si, ta], i) => (
          <span key={i} className="flex items-center gap-2"><span className="text-xl">{e}</span>{si} · {ta} · {en}</span>
        ))}
      </div>
    </div>
  );
};

const Waves: React.FC = () => (
  <div className="absolute -bottom-px left-0 right-0 h-16 sm:h-24 overflow-hidden pointer-events-none" aria-hidden>
    {([['#F5B335', 0.35, 28], ['#FFF9ED', 1, 40]] as const).map(([fill, op, dur], i) => (
      <svg key={i} viewBox="0 0 2400 100" preserveAspectRatio="none" className="absolute bottom-0 h-full w-[200%]" data-lh-anim
        style={{ animation: `lhWave ${dur}s linear infinite`, opacity: op, animationDirection: i ? 'normal' : 'reverse' }}>
        <path d="M0 55 Q150 5 300 55 T600 55 T900 55 T1200 55 T1500 55 T1800 55 T2100 55 T2400 55 V100 H0Z" fill={fill} />
      </svg>
    ))}
  </div>
);

/* ─── Page ──────────────────────────────────────────────────────────────────── */
export const LandingPage: React.FC = () => {
  const { language, setLanguage } = useLanguage();
  const c = COPY[language];
  const [greet, setGreet] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setGreet(g => (g + 1) % GREETINGS.length), 2600);
    return () => clearInterval(id);
  }, []);

  const { data, isLoading } = useQuery({ queryKey: ['landing-prices'], queryFn: () => pricesApi.getCurrent(), staleTime: 5 * 60 * 1000, retry: 1 });
  const prices: any[] = (data?.data?.data || []).slice(0, 6);
  const first = prices[0];
  const cropName = (p: any) => formatCategoryForLanguage(p.crop_categories, language) || p.crop_categories?.name;

  const STEP_ICONS = [UserPlus, Scale, ClipboardCheck, Banknote];

  return (
    <div className="min-h-screen bg-[#FFF9ED] text-emerald-950 overflow-x-hidden">
      <style>{STYLES}</style>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#FFF9ED]/90 backdrop-blur border-b border-amber-200/60">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <span className="w-9 h-9 rounded-xl bg-emerald-800 flex items-center justify-center"><Sprout size={19} className="text-amber-300" /></span>
            <span className="font-display font-extrabold text-emerald-950 leading-tight text-sm sm:text-base">Saara Ketha<span className="block text-[11px] font-medium text-emerald-700 -mt-0.5">Harvest Hub</span></span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-emerald-900/80">
            <a href="#how" className="hover:text-emerald-950">{c.nav.how}</a>
            <a href="#prices" className="hover:text-emerald-950">{c.nav.prices}</a>
            <a href="#advisor" className="hover:text-emerald-950">{c.nav.advisor}</a>
          </nav>
          <div className="flex items-center gap-2">
            <div className="flex rounded-full bg-white border border-amber-200 p-0.5 text-xs font-semibold" role="group" aria-label="Language">
              {([['si', 'සිං'], ['ta', 'தமி'], ['en', 'EN']] as const).map(([code, label]) => (
                <button key={code} onClick={() => setLanguage(code)} aria-pressed={language === code}
                  className={`px-2.5 py-1 rounded-full transition ${language === code ? 'bg-emerald-800 text-white' : 'text-emerald-900 hover:bg-amber-100'}`}>{label}</button>
              ))}
            </div>
            <Link to="/login" className="hidden sm:inline-flex px-3.5 py-2 text-sm font-semibold text-emerald-900 hover:bg-amber-100 rounded-lg">{c.signIn}</Link>
            <Link to="/register" className="hidden sm:inline-flex px-4 py-2 text-sm font-bold rounded-lg text-emerald-950 hover:brightness-95" style={{ background: GOLD }}>{c.register}</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-emerald-950 text-white">
        <img src={photo(IMG.hero, 1800)} alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full object-cover" data-lh-anim style={{ animation: 'lhKen 24s ease-in-out infinite alternate' }} />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-emerald-950/95 via-emerald-950/70 to-emerald-950/10" />
        <div className="absolute -top-16 -right-16 h-72 w-72 rounded-full -z-10 blur-2xl" data-lh-anim style={{ background: 'radial-gradient(circle,#F5B335 0%,transparent 70%)', animation: 'lhSun 7s ease-in-out infinite' }} />

        <div className="max-w-6xl mx-auto px-4 pt-16 pb-40 sm:pt-24 sm:pb-52">
          <p className="lh-rise inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider rounded-full px-3 py-1 bg-white/10 border border-white/25" style={{ animationDelay: '.05s' }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: GOLD }} /> {c.heroTag}
          </p>
          <div className="h-12 sm:h-14 mt-4 overflow-hidden">
            <div key={greet} className="font-display font-extrabold text-4xl sm:text-5xl" data-lh-anim style={{ color: GOLD, animation: 'lhFade 2.6s ease both' }}>{GREETINGS[greet]}</div>
          </div>
          <h1 className="lh-rise mt-2 max-w-2xl break-words font-display font-extrabold text-[1.65rem] sm:text-5xl leading-[1.2]" style={{ animationDelay: '.2s' }}>{c.heroTitle}</h1>
          <p className="lh-rise mt-5 max-w-xl text-base sm:text-lg text-emerald-50/90" style={{ animationDelay: '.35s' }}>{c.heroSub}</p>
          <div className="lh-rise mt-8 flex flex-wrap items-center gap-3" style={{ animationDelay: '.5s' }}>
            <Link to="/register" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-emerald-950 shadow-lg hover:brightness-95 transition" style={{ background: GOLD }}>
              {c.heroCta} <ArrowRight size={18} />
            </Link>
            <a href="#prices" className="inline-flex items-center px-5 py-3.5 rounded-xl border border-white/40 font-semibold hover:bg-white/10 transition">{c.heroPrices}</a>
          </div>

          {first && (
            <div className="absolute right-4 bottom-28 sm:bottom-36 hidden md:block lh-rise" style={{ animationDelay: '.8s' }}>
              <div className="rounded-2xl bg-white/95 text-emerald-950 shadow-2xl px-5 py-4 w-60" data-lh-anim style={{ animation: 'lhBob 5s ease-in-out infinite' }}>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">{c.todayCard}</div>
                <div className="mt-1 font-bold truncate">{cropName(first)}</div>
                <div className="text-2xl font-extrabold font-display text-emerald-800">Rs. {Number(first.purchase_price).toFixed(2)}<span className="text-xs font-medium text-emerald-700"> / kg</span></div>
              </div>
            </div>
          )}
        </div>
        <Waves />
      </section>

      <Marquee />

      {/* How it works */}
      <section id="how" className="py-16 sm:py-24">
        <div className="max-w-6xl mx-auto px-4">
          <Reveal className="text-center">
            <Lotus size={40} color={MAROON} className="mx-auto mb-3" />
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl">{c.stepsTitle}</h2>
          </Reveal>
          <div className="relative mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="hidden lg:block absolute top-[60px] left-[12%] right-[12%] h-0.5 bg-amber-200">
              <div className="lh-line h-full w-full" style={{ background: MAROON }} />
            </div>
            {c.steps.map((s, i) => {
              const Icon = STEP_ICONS[i];
              return (
                <Reveal key={s.t} delay={i * 0.12}>
                  <div className="lh-card relative z-10 h-full bg-white rounded-2xl border border-amber-200/80 p-6 text-center">
                    <div className="mx-auto h-[72px] w-[72px] rounded-full flex items-center justify-center text-white shadow-md" style={{ background: i % 2 ? '#166534' : MAROON }}>
                      <Icon size={30} />
                    </div>
                    <div className="mt-4 text-xs font-bold tracking-widest text-amber-600">0{i + 1}</div>
                    <h3 className="mt-1 font-display font-bold text-lg">{s.t}</h3>
                    <p className="mt-2 text-sm text-emerald-900/75">{s.d}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Prices + audiences */}
      <section id="prices" className="py-16 sm:py-20 bg-emerald-900 text-white relative overflow-hidden">
        <Lotus size={420} color="#fff" spin className="absolute -left-40 -bottom-40 opacity-[0.06]" />
        <div className="relative max-w-6xl mx-auto px-4 grid lg:grid-cols-5 gap-10 items-start">
          <Reveal className="lg:col-span-3">
            <div className="rounded-2xl bg-white text-emerald-950 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-amber-100">
                <div className="flex items-center gap-2 font-display font-bold text-lg">
                  <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600" /></span>
                  {c.pricesTitle}
                </div>
                <span className="text-xs text-emerald-700 font-medium">{c.pricesSub}</span>
              </div>
              {isLoading ? (
                <div className="p-5 space-y-3">{[0, 1, 2].map(i => <div key={i} className="skeleton h-9 rounded-lg" />)}</div>
              ) : prices.length === 0 ? (
                <div className="p-8 text-center text-sm text-emerald-800/70">{c.pricesEmpty}</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-emerald-700/80"><tr>
                    <th className="text-left font-semibold px-5 py-2.5">{c.colCrop}</th>
                    <th className="text-right font-semibold py-2.5">{c.colPay}</th>
                    <th className="text-right font-semibold px-5 py-2.5">{c.colBuy}</th>
                  </tr></thead>
                  <tbody className="divide-y divide-amber-100">
                    {prices.map((p: any) => (
                      <tr key={p.id} className="hover:bg-amber-50 transition-colors">
                        <td className="px-5 py-3 font-semibold">{cropName(p)} <span className="ml-1 text-xs font-medium text-emerald-700/70 uppercase">{p.grade?.replace('grade_', '')}</span></td>
                        <td className="py-3 text-right font-bold text-emerald-800">{Number(p.purchase_price).toFixed(2)}</td>
                        <td className="px-5 py-3 text-right text-emerald-900/80">{Number(p.selling_price).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <Link to="/prices" className="flex items-center justify-between px-5 py-3.5 text-sm font-bold border-t border-amber-100 hover:bg-amber-50" style={{ color: MAROON }}>
                {c.pricesAll} <ArrowRight size={16} />
              </Link>
            </div>
          </Reveal>

          <div className="lg:col-span-2 space-y-5">
            {[{ ...c.farmers, icon: Tractor, tone: GOLD }, { ...c.buyers, icon: ShoppingBasket, tone: '#fff' }].map((a, i) => (
              <Reveal key={a.t} delay={0.15 + i * 0.15}>
                <div className="lh-card rounded-2xl bg-white/10 border border-white/20 p-6 backdrop-blur-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="h-11 w-11 rounded-xl flex items-center justify-center" style={{ background: a.tone, color: '#14532d' }}><a.icon size={22} /></span>
                    <h3 className="font-display font-bold text-xl">{a.t}</h3>
                  </div>
                  <ul className="space-y-2 text-sm text-emerald-50/95">
                    {a.items.map(t => <li key={t} className="flex gap-2"><CheckCircle2 size={17} className="shrink-0 mt-0.5" style={{ color: GOLD }} />{t}</li>)}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Advisor */}
      <section id="advisor" className="py-16 sm:py-24">
        <div className="max-w-6xl mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center">
          <Reveal>
            <div className="relative rounded-3xl overflow-hidden aspect-[4/3] shadow-xl bg-emerald-900">
              <img src={photo(IMG.spices, 900)} alt="" aria-hidden className="h-full w-full object-cover" loading="lazy" />
              <div className="absolute inset-x-5 bottom-5 space-y-2.5 text-sm">
                <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-emerald-800 text-white px-4 py-2.5 shadow-lg">{c.advisorChat.q}</div>
                <div className="max-w-[88%] rounded-2xl rounded-bl-sm bg-white text-emerald-950 px-4 py-2.5 shadow-lg flex gap-2"><Bot size={18} className="shrink-0 mt-0.5 text-emerald-700" />{c.advisorChat.a}</div>
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.15}>
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl leading-tight">{c.advisorTitle}</h2>
            <p className="mt-4 text-emerald-900/80 text-lg">{c.advisorSub}</p>
            <Link to="/register" className="mt-7 inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-white hover:brightness-110 transition" style={{ background: MAROON }}>
              {c.heroCta} <ArrowRight size={18} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-emerald-950 text-white">
        <img src={photo(IMG.rows, 1600)} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-30" loading="lazy" />
        <Lotus size={220} color={GOLD} spin className="absolute -right-16 -top-16 opacity-25" />
        <Lotus size={160} color="#fff" spin className="absolute -left-10 -bottom-10 opacity-10" />
        <Reveal className="relative max-w-3xl mx-auto px-4 py-20 text-center">
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl">{c.ctaTitle}</h2>
          <p className="mt-3 text-emerald-100 text-lg">{c.ctaSub}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/register" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-emerald-950 hover:brightness-95" style={{ background: GOLD }}>{c.register} <ArrowRight size={18} /></Link>
            <Link to="/login" className="inline-flex items-center px-7 py-3.5 rounded-xl border border-white/40 font-semibold hover:bg-white/10">{c.signIn}</Link>
          </div>
        </Reveal>
      </section>

      <footer className="bg-emerald-950 border-t border-white/10 text-emerald-200/80 text-sm">
        <div className="max-w-6xl mx-auto px-4 py-7 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-2 text-white font-display font-bold"><Sprout size={18} style={{ color: GOLD }} /> {c.footer}</div>
          <p>{c.help}</p>
          <p className="text-xs text-emerald-300/60">© 2026 · ISE_WE_0101_23 · Photos: Unsplash</p>
        </div>
      </footer>
    </div>
  );
};
