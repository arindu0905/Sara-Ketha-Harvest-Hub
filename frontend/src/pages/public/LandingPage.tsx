import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, CheckCircle, BarChart3, Shield, Truck, DollarSign, Package, Users, Leaf, Star,
  Sprout, Bot, Zap, Globe, Lock, Cloud, Activity, Award, Timer, Heart, TrendingUp,
  MapPin, Phone, Mail, ChevronRight, Sparkles, CircleDot, Eye, Droplets, Sun
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════ */
/* ═══ AGRICULTURE ANIMATION COMPONENTS ════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─── Floating Leaves ──────────────────────────────────────────────────────── */
const FloatingLeaves: React.FC<{ count?: number }> = ({ count = 12 }) => {
  const leaves = useMemo(() => {
    const leafEmojis = ['🍃', '🌿', '☘️', '🍂', '🌱'];
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      emoji: leafEmojis[i % leafEmojis.length],
      left: `${(i / count) * 100 + Math.random() * 5}%`,
      duration: `${7 + Math.random() * 8}s`,
      delay: `${Math.random() * 10}s`,
      size: 12 + Math.random() * 14,
      opacity: 0.15 + Math.random() * 0.2,
    }));
  }, [count]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {leaves.map((leaf) => (
        <span
          key={leaf.id}
          className="absolute top-0 animate-float-leaf"
          style={{
            left: leaf.left,
            fontSize: `${leaf.size}px`,
            opacity: leaf.opacity,
            '--leaf-duration': leaf.duration,
            '--leaf-delay': leaf.delay,
          } as React.CSSProperties}
        >
          {leaf.emoji}
        </span>
      ))}
    </div>
  );
};

/* ─── Gentle Rain ──────────────────────────────────────────────────────────── */
const GentleRain: React.FC<{ count?: number }> = ({ count = 30 }) => {
  const drops = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      duration: `${1.2 + Math.random() * 1.5}s`,
      delay: `${Math.random() * 3}s`,
      height: 12 + Math.random() * 20,
      opacity: 0.08 + Math.random() * 0.12,
    })),
    [count]
  );

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {drops.map((drop) => (
        <div
          key={drop.id}
          className="absolute top-0 animate-rain-drop rounded-full"
          style={{
            left: drop.left,
            width: '1.5px',
            height: `${drop.height}px`,
            background: 'linear-gradient(to bottom, transparent, rgba(167, 243, 208, 0.6))',
            opacity: drop.opacity,
            '--rain-duration': drop.duration,
            '--rain-delay': drop.delay,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
};

/* ─── Wheat Field (bottom SVG stalks that sway) ────────────────────────────── */
const WheatField: React.FC = () => {
  const stalks = useMemo(() =>
    Array.from({ length: 18 }, (_, i) => ({
      id: i,
      x: (i / 18) * 100,
      height: 40 + Math.random() * 35,
      delay: `${i * 0.15}s`,
      opacity: 0.12 + Math.random() * 0.12,
    })),
    []
  );

  return (
    <div className="absolute bottom-0 left-0 right-0 pointer-events-none h-24 overflow-hidden">
      <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="absolute bottom-0 w-full h-full">
        {stalks.map((s) => (
          <g key={s.id} className="animate-wheat-sway" style={{ animationDelay: s.delay, transformOrigin: `${s.x}% 100%` }}>
            {/* Stalk */}
            <line
              x1={s.x}
              y1={24}
              x2={s.x}
              y2={24 - s.height * 0.3}
              stroke="rgba(167, 243, 208, 0.25)"
              strokeWidth="0.3"
              opacity={s.opacity}
            />
            {/* Wheat head - tiny oval */}
            <ellipse
              cx={s.x}
              cy={24 - s.height * 0.3}
              rx="0.6"
              ry="1.2"
              fill="rgba(253, 224, 71, 0.2)"
              opacity={s.opacity}
            />
            {/* Small leaf */}
            <line
              x1={s.x}
              y1={24 - s.height * 0.15}
              x2={s.x + 1.5}
              y2={24 - s.height * 0.2}
              stroke="rgba(167, 243, 208, 0.18)"
              strokeWidth="0.2"
              opacity={s.opacity}
            />
          </g>
        ))}
      </svg>
    </div>
  );
};

/* ─── Fireflies (twinkling dots) ───────────────────────────────────────────── */
const Fireflies: React.FC<{ count?: number; color?: string }> = ({ count = 15, color = 'rgba(52, 211, 153, 0.7)' }) => {
  const flies = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      top: `${10 + Math.random() * 80}%`,
      left: `${Math.random() * 100}%`,
      duration: `${3 + Math.random() * 4}s`,
      delay: `${Math.random() * 5}s`,
      size: 2 + Math.random() * 3,
    })),
    [count]
  );

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {flies.map((f) => (
        <div
          key={f.id}
          className="absolute rounded-full animate-firefly"
          style={{
            top: f.top,
            left: f.left,
            width: `${f.size}px`,
            height: `${f.size}px`,
            backgroundColor: color,
            boxShadow: `0 0 ${f.size * 3}px ${color}`,
            '--fly-duration': f.duration,
            '--fly-delay': f.delay,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
};

/* ─── Drifting Clouds ──────────────────────────────────────────────────────── */
const DriftingClouds: React.FC = () => {
  const clouds = useMemo(() => [
    { id: 0, top: '8%', duration: '45s', delay: '0s', scale: 1, opacity: 0.04 },
    { id: 1, top: '18%', duration: '55s', delay: '12s', scale: 0.7, opacity: 0.03 },
    { id: 2, top: '5%', duration: '60s', delay: '25s', scale: 0.5, opacity: 0.03 },
  ], []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {clouds.map((c) => (
        <div
          key={c.id}
          className="absolute animate-drift-cloud"
          style={{
            top: c.top,
            '--cloud-duration': c.duration,
            '--cloud-delay': c.delay,
            transform: `scale(${c.scale})`,
          } as React.CSSProperties}
        >
          <svg width="200" height="60" viewBox="0 0 200 60" fill="none">
            <ellipse cx="100" cy="35" rx="80" ry="25" fill={`rgba(255,255,255,${c.opacity})`} />
            <ellipse cx="65" cy="28" rx="50" ry="20" fill={`rgba(255,255,255,${c.opacity})`} />
            <ellipse cx="140" cy="30" rx="45" ry="18" fill={`rgba(255,255,255,${c.opacity})`} />
          </svg>
        </div>
      ))}
    </div>
  );
};

/* ─── Sun Rays ─────────────────────────────────────────────────────────────── */
const SunRays: React.FC = () => (
  <div className="absolute top-0 right-0 pointer-events-none overflow-hidden w-80 h-80">
    <div className="animate-sun-pulse" style={{ transformOrigin: 'top right' }}>
      <svg viewBox="0 0 300 300" className="w-full h-full opacity-20">
        {Array.from({ length: 12 }, (_, i) => {
          const angle = (i * 30 * Math.PI) / 180;
          return (
            <line
              key={i}
              x1="280"
              y1="20"
              x2={280 + Math.cos(angle) * 250}
              y2={20 + Math.sin(angle) * 250}
              stroke="rgba(253, 224, 71, 0.15)"
              strokeWidth="1"
            />
          );
        })}
        <circle cx="280" cy="20" r="18" fill="rgba(253, 224, 71, 0.12)" />
        <circle cx="280" cy="20" r="10" fill="rgba(253, 224, 71, 0.2)" />
      </svg>
    </div>
  </div>
);

/* ─── Animated Growing Sprout SVG ──────────────────────────────────────────── */
const GrowingSprout: React.FC<{ visible: boolean }> = ({ visible }) => (
  <div className={`flex justify-center ${visible ? 'animate-grow-sprout' : 'opacity-0'}`}>
    <svg width="60" height="80" viewBox="0 0 60 80" fill="none">
      {/* Soil */}
      <ellipse cx="30" cy="74" rx="20" ry="5" fill="rgba(120, 80, 40, 0.3)" />
      {/* Stem */}
      <path d="M30 74 C30 58, 30 45, 30 35" stroke="rgba(52, 211, 153, 0.5)" strokeWidth="2.5" strokeLinecap="round" />
      {/* Left leaf */}
      <path d="M30 50 C20 42, 12 44, 14 36 C16 28, 28 38, 30 50" fill="rgba(52, 211, 153, 0.35)" />
      {/* Right leaf */}
      <path d="M30 40 C40 32, 48 34, 46 26 C44 18, 32 28, 30 40" fill="rgba(74, 222, 128, 0.35)" />
      {/* Top sprout */}
      <path d="M30 35 C26 28, 28 18, 30 12 C32 18, 34 28, 30 35" fill="rgba(52, 211, 153, 0.4)" />
    </svg>
  </div>
);

/* ─── Scroll-Reveal Wrapper ────────────────────────────────────────────────── */
const ScrollReveal: React.FC<{
  children: React.ReactNode;
  className?: string;
  delay?: number;
}> = ({ children, className = '', delay = 0 }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${className} transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};


/* ═══════════════════════════════════════════════════════════════════════════ */
/* ═══ DATA ════════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════════════════ */

const services = [
  {
    icon: <Users className="w-6 h-6" />,
    title: 'Farmer Management',
    desc: 'End-to-end digital registration with NIC verification, crop history, land records, and payment tracking for every registered farmer.',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
  },
  {
    icon: <Package className="w-6 h-6" />,
    title: 'Produce Collection & Weighing',
    desc: 'Digital weighing at collection points, quality grading, batch assignment, and complete chain-of-custody from field to warehouse.',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
  },
  {
    icon: <CheckCircle className="w-6 h-6" />,
    title: 'Quality Inspection',
    desc: 'Grade-based acceptance and rejection with documented reasons, inspection images, and complete traceability audit trails.',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
  },
  {
    icon: <Leaf className="w-6 h-6" />,
    title: 'Inventory & Warehouse',
    desc: 'Real-time stock levels across warehouses with FEFO allocation, near-expiry alerts, batch tracking, and wastage management.',
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
  },
  {
    icon: <DollarSign className="w-6 h-6" />,
    title: 'Farmer Payments & Finance',
    desc: 'Automated payment calculation with grade-based pricing tiers, buyer invoicing, deduction management, and financial reporting.',
    iconBg: 'bg-violet-100',
    iconColor: 'text-violet-600',
  },
  {
    icon: <BarChart3 className="w-6 h-6" />,
    title: 'Analytics & Reports',
    desc: 'Rich visual dashboards with collection trends, revenue charts, wastage analytics, and exportable CSV/PDF business reports.',
    iconBg: 'bg-rose-100',
    iconColor: 'text-rose-600',
  },
  {
    icon: <Truck className="w-6 h-6" />,
    title: 'Transport & Delivery',
    desc: 'Delivery scheduling, vehicle assignment, route management, and live delivery status tracking for buyer order fulfillment.',
    iconBg: 'bg-sky-100',
    iconColor: 'text-sky-600',
  },
  {
    icon: <Bot className="w-6 h-6" />,
    title: 'AI Crop Advisory (Java ML)',
    desc: 'Java Weka Random Forest Classifier predicts optimal crops based on district location, previous crop rotation, soil pH, and rainfall patterns.',
    iconBg: 'bg-teal-100',
    iconColor: 'text-teal-600',
  },
];

const reliabilityStats = [
  { value: '99.9%', label: 'System Uptime', icon: <Activity size={20} />, desc: 'Powered by Supabase Cloud' },
  { value: '25', label: 'Sri Lanka Districts', icon: <MapPin size={20} />, desc: 'Complete island coverage' },
  { value: '8', label: 'Distinct Roles', icon: <Users size={20} />, desc: 'Fine-grained access control' },
  { value: 'AES-256', label: 'Encryption', icon: <Lock size={20} />, desc: 'Bank-grade data security' },
];

const trustPillars = [
  {
    icon: <Shield size={28} />,
    title: 'Enterprise-Grade Security',
    desc: 'Row-level security via Supabase, JWT authentication, role-based access control (RBAC), and comprehensive audit logging for every action.',
    color: 'text-emerald-600', bg: 'bg-emerald-50',
  },
  {
    icon: <Cloud size={28} />,
    title: 'Cloud-Native Architecture',
    desc: 'Built on Supabase Cloud with PostgreSQL, real-time subscriptions, edge functions, and automatic backups ensuring zero data loss.',
    color: 'text-blue-600', bg: 'bg-blue-50',
  },
  {
    icon: <Globe size={28} />,
    title: 'Trilingual Accessibility',
    desc: 'Full interface support for English, Sinhala (සිංහල), and Tamil (தமிழ்) — ensuring every farmer across Sri Lanka can use the system.',
    color: 'text-violet-600', bg: 'bg-violet-50',
  },
  {
    icon: <Zap size={28} />,
    title: 'Real-Time Operations',
    desc: 'Live inventory updates, instant notification delivery, real-time auction bidding, and immediate payment status across all stakeholders.',
    color: 'text-amber-600', bg: 'bg-amber-50',
  },
];

const roles = [
  { emoji: '👨‍🌾', role: 'Farmer', desc: 'Register crops, schedule deliveries, track payments, and get AI-powered crop recommendations.' },
  { emoji: '🏢', role: 'Collection Officer', desc: 'Manage farmer verification, record produce collections, and coordinate deliveries.' },
  { emoji: '🔬', role: 'Quality Inspector', desc: 'Grade produce quality, issue certifications, and manage inspection workflows.' },
  { emoji: '📦', role: 'Inventory Manager', desc: 'Track warehouse stock levels, manage batch allocation, and monitor expiry dates.' },
  { emoji: '🛒', role: 'Buyer', desc: 'Browse product marketplace, place orders, and participate in produce auctions.' },
  { emoji: '💰', role: 'Finance Officer', desc: 'Process farmer payments, manage buyer invoices, and generate financial reports.' },
  { emoji: '🚛', role: 'Transport Coordinator', desc: 'Schedule delivery vehicles, manage routes, and track active shipments.' },
  { emoji: '⚙️', role: 'Administrator', desc: 'Full system control — users, prices, centres, crop categories, and audit logs.' },
];


/* ═══════════════════════════════════════════════════════════════════════════ */
/* ═══ HOOKS ═══════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════════════════ */

function useCountUp(end: number, duration: number = 1500, isVisible: boolean = true) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!isVisible) return;
    let start = 0;
    const increment = end / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) { setCount(end); clearInterval(timer); }
      else { setCount(Math.floor(start)); }
    }, 16);
    return () => clearInterval(timer);
  }, [end, duration, isVisible]);
  return count;
}

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}


/* ═══════════════════════════════════════════════════════════════════════════ */
/* ═══ LANDING PAGE COMPONENT ═════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════════════════ */

export const LandingPage: React.FC = () => {
  const statsSection = useInView(0.25);
  const servicesSection = useInView(0.1);
  const aiSection = useInView(0.2);
  const farmersCount = useCountUp(2500, 1800, statsSection.inView);
  const collectionsCount = useCountUp(45000, 2000, statsSection.inView);
  const paymentsCount = useCountUp(12, 1200, statsSection.inView);

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">

      {/* ═══ Navbar ═══════════════════════════════════════════════════════════ */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-2xl border-b border-surface-100/70 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-gradient-to-br from-emerald-600 to-primary-700 rounded-xl flex items-center justify-center shadow-sm">
                <Sprout size={20} className="text-white" />
              </div>
              <div>
                <span className="text-base font-extrabold text-surface-900 font-display tracking-tight">Sara Ketha</span>
                <span className="text-xs font-medium text-surface-400 block -mt-0.5">Harvest Hub</span>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-surface-500">
              <a href="#services" className="hover:text-emerald-600 transition-colors">Services</a>
              <a href="#reliability" className="hover:text-emerald-600 transition-colors">Reliability</a>
              <a href="#roles" className="hover:text-emerald-600 transition-colors">Who It's For</a>
              <Link to="/prices" className="hover:text-emerald-600 transition-colors">Crop Prices</Link>
              <Link to="/auctions" className="hover:text-emerald-600 transition-colors flex items-center gap-1">
                <Sparkles size={14} className="text-amber-500" /> Auctions
              </Link>
            </div>

            <div className="flex items-center gap-2.5">
              <Link to="/login" className="btn-secondary btn-sm hidden sm:flex font-semibold">Sign In</Link>
              <Link to="/register" className="btn-primary btn-sm font-semibold">Get Started</Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ═══ Hero — with floating leaves, gentle rain, wheat field, clouds ════ */}
      <section className="relative bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-900 text-white pt-20 pb-28 px-4 overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-10 left-[10%] w-72 h-72 bg-emerald-500/10 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 right-[5%] w-96 h-96 bg-teal-400/8 rounded-full blur-[120px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-800/5 rounded-full blur-[150px]" />
          {/* Dot grid */}
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        </div>

        {/* 🌿 Floating leaves animation */}
        <FloatingLeaves count={14} />

        {/* 🌧️ Gentle rain animation */}
        <GentleRain count={35} />

        {/* ☁️ Drifting clouds */}
        <DriftingClouds />

        {/* 🌾 Wheat field at bottom */}
        <WheatField />

        <div className="relative max-w-5xl mx-auto text-center z-10">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 backdrop-blur-lg rounded-full px-4 py-2 text-sm text-emerald-300/90 mb-8">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="font-medium">Empowering Sri Lankan Agriculture with Technology</span>
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold font-display leading-[1.05] mb-7 tracking-tight">
            <span className="text-white/95">Farm to Market,</span>
            <br />
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">Digitally Connected</span>
          </h1>

          <p className="text-lg md:text-xl text-slate-300/90 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
            Sara Ketha Harvest Hub is a comprehensive agricultural management platform that digitizes
            farmer registrations, crop deliveries, quality grading, inventory, buyer orders,
            and payments — replacing paper-based workflows with one secure, integrated system.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 mb-6">
            <Link
              to="/register"
              className="group inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-7 py-3.5 rounded-2xl font-bold text-base shadow-xl shadow-emerald-900/40 transition-all duration-200 hover:shadow-emerald-500/30 hover:-translate-y-0.5"
            >
              Get Started Free <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/prices"
              className="inline-flex items-center gap-2 bg-white/5 border border-white/15 backdrop-blur-lg text-white/90 hover:bg-white/10 px-7 py-3.5 rounded-2xl font-semibold text-base transition-all"
            >
              View Crop Prices
            </Link>
          </div>

          {/* Trust badges */}
          <div className="flex items-center justify-center gap-6 mt-12 text-xs text-slate-400 font-medium">
            <span className="flex items-center gap-1.5"><Lock size={14} className="text-emerald-400" /> SSL Encrypted</span>
            <span className="flex items-center gap-1.5"><Shield size={14} className="text-emerald-400" /> RBAC Secured</span>
            <span className="flex items-center gap-1.5"><Globe size={14} className="text-emerald-400" /> EN · සිං · தமி</span>
            <span className="flex items-center gap-1.5"><Cloud size={14} className="text-emerald-400" /> Cloud Hosted</span>
          </div>
        </div>
      </section>

      {/* ═══ Live Impact Counter Strip ════════════════════════════════════════ */}
      <div ref={statsSection.ref} className="relative -mt-12 z-10 max-w-5xl mx-auto px-4">
        <div className="bg-white rounded-3xl shadow-xl border border-surface-100/80 grid grid-cols-2 md:grid-cols-4 divide-x divide-surface-100">
          <div className="p-6 text-center">
            <div className="text-3xl font-extrabold font-display text-emerald-700">{farmersCount.toLocaleString()}+</div>
            <div className="text-sm font-semibold text-surface-600 mt-1">Farmers Registered</div>
            <div className="text-xs text-surface-400 mt-0.5">Across all 25 districts</div>
          </div>
          <div className="p-6 text-center">
            <div className="text-3xl font-extrabold font-display text-emerald-700">{collectionsCount.toLocaleString()}+</div>
            <div className="text-sm font-semibold text-surface-600 mt-1">Collections Processed</div>
            <div className="text-xs text-surface-400 mt-0.5">Tonnes of produce managed</div>
          </div>
          <div className="p-6 text-center">
            <div className="text-3xl font-extrabold font-display text-emerald-700">LKR {paymentsCount}M+</div>
            <div className="text-sm font-semibold text-surface-600 mt-1">Farmer Payments</div>
            <div className="text-xs text-surface-400 mt-0.5">Directly to bank accounts</div>
          </div>
          <div className="p-6 text-center">
            <div className="text-3xl font-extrabold font-display text-emerald-700">100%</div>
            <div className="text-sm font-semibold text-surface-600 mt-1">Digitized Workflow</div>
            <div className="text-xs text-surface-400 mt-0.5">No more paper records</div>
          </div>
        </div>
      </div>

      {/* ═══ Services Section — with sun rays and scroll-reveal cards ═════════ */}
      <section id="services" className="py-28 px-4 bg-slate-50/50 relative overflow-hidden">
        {/* ☀️ Sun rays decoration */}
        <SunRays />

        <div className="max-w-7xl mx-auto relative z-10" ref={servicesSection.ref}>
          <ScrollReveal className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider mb-4 border border-emerald-200/60">
              <CircleDot size={14} /> Our Services
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold font-display text-surface-900 mb-5 tracking-tight">
              Everything Your Agricultural
              <br className="hidden md:block" />
              <span className="text-emerald-700"> Supply Chain Needs</span>
            </h2>
            <p className="text-lg text-surface-500 max-w-2xl mx-auto leading-relaxed">
              From the moment a farmer registers to when produce reaches buyers — Sara Ketha covers every link in the chain with precision.
            </p>
          </ScrollReveal>

          {/* Growing sprout between heading and cards */}
          <div className="flex justify-center mb-10">
            <GrowingSprout visible={servicesSection.inView} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {services.map((svc, idx) => (
              <ScrollReveal key={svc.title} delay={idx * 80}>
                <div className="group bg-white rounded-2xl p-6 border border-surface-100/80 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-default h-full">
                  <div className={`w-12 h-12 ${svc.iconBg} ${svc.iconColor} rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                    {svc.icon}
                  </div>
                  <h3 className="text-base font-bold text-surface-900 mb-2">{svc.title}</h3>
                  <p className="text-sm text-surface-500 leading-relaxed">{svc.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Reliability & Trust Section — with scroll reveals ════════════════ */}
      <section id="reliability" className="py-28 px-4 bg-white relative overflow-hidden">
        {/* Subtle agriculture pattern background */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.02]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Ctext x='15' y='35' font-size='20' fill='%2316a34a'%3E🌾%3C/text%3E%3C/svg%3E")`,
            backgroundSize: '80px 80px',
          }}
        />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left column */}
            <ScrollReveal>
              <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider mb-5 border border-blue-200/60">
                <Shield size={14} /> Reliability & Trust
              </div>
              <h2 className="text-4xl md:text-5xl font-extrabold font-display text-surface-900 mb-6 tracking-tight leading-tight">
                Built to Be
                <span className="text-emerald-700"> Reliable,</span>
                <br />
                Trusted by Users
              </h2>
              <p className="text-lg text-surface-500 leading-relaxed mb-8">
                Sara Ketha Harvest Hub is designed with enterprise-grade security and cloud-native architecture.
                Every transaction is audited, every payment is traceable, and every user's data is protected with bank-grade encryption.
              </p>

              <div className="grid grid-cols-2 gap-4">
                {reliabilityStats.map((stat, idx) => (
                  <ScrollReveal key={stat.label} delay={idx * 100}>
                    <div className="bg-slate-50 rounded-2xl p-4 border border-surface-100/80">
                      <div className="text-emerald-600 mb-2">{stat.icon}</div>
                      <div className="text-2xl font-extrabold font-display text-surface-900">{stat.value}</div>
                      <div className="text-sm font-semibold text-surface-700 mt-0.5">{stat.label}</div>
                      <div className="text-xs text-surface-400 mt-0.5">{stat.desc}</div>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
            </ScrollReveal>

            {/* Right column — Trust pillars */}
            <div className="space-y-4">
              {trustPillars.map((pillar, idx) => (
                <ScrollReveal key={pillar.title} delay={150 + idx * 120}>
                  <div className="group flex items-start gap-5 bg-white rounded-2xl p-6 border border-surface-100/80 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                    <div className={`${pillar.bg} ${pillar.color} w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                      {pillar.icon}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-surface-900 mb-1.5">{pillar.title}</h3>
                      <p className="text-sm text-surface-500 leading-relaxed">{pillar.desc}</p>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Who It's For (Roles) — with staggered scroll reveal ══════════════ */}
      <section id="roles" className="py-28 px-4 bg-slate-50/50 relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <ScrollReveal className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-violet-50 text-violet-700 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider mb-4 border border-violet-200/60">
              <Eye size={14} /> Role-Based Access
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold font-display text-surface-900 mb-5 tracking-tight">
              Built for <span className="text-emerald-700">Every Stakeholder</span>
            </h2>
            <p className="text-lg text-surface-500 max-w-2xl mx-auto">
              Each role has a dedicated dashboard, permissions, and workflow tailored to their responsibilities.
            </p>
          </ScrollReveal>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {roles.map((r, idx) => (
              <ScrollReveal key={r.role} delay={idx * 70}>
                <div className="group bg-white rounded-2xl p-6 text-center border border-surface-100/80 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-default h-full">
                  <div className="text-4xl mb-4 group-hover:scale-125 group-hover:rotate-6 transition-transform duration-300">{r.emoji}</div>
                  <h3 className="text-sm font-bold text-surface-900 mb-2">{r.role}</h3>
                  <p className="text-xs text-surface-500 leading-relaxed">{r.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ AI / ML Engine — with fireflies ═════════════════════════════════ */}
      <section ref={aiSection.ref} className="py-24 px-4 bg-gradient-to-br from-emerald-950 via-slate-900 to-emerald-950 text-white relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-[15%] w-64 h-64 bg-emerald-500/8 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 left-[10%] w-80 h-80 bg-teal-400/5 rounded-full blur-[120px]" />
        </div>

        {/* ✨ Fireflies */}
        <Fireflies count={20} color="rgba(52, 211, 153, 0.6)" />

        {/* 🌿 Floating leaves (sparse, for dark bg) */}
        <FloatingLeaves count={6} />

        <div className="relative max-w-5xl mx-auto text-center z-10">
          <ScrollReveal>
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm text-emerald-300 mb-6 backdrop-blur-lg">
              <Bot size={16} className="text-emerald-400" /> Java ML / Weka Engine
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold font-display mb-6 tracking-tight">
              AI-Powered Crop <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">Recommendations</span>
            </h2>
            <p className="text-lg text-slate-300/90 max-w-2xl mx-auto mb-10 leading-relaxed">
              Our Java Weka Random Forest Classifier analyzes district-level agro-climatic data, historical crop rotation,
              soil pH levels, and seasonal rainfall patterns to predict the highest-yielding crops for your farm — in English, Sinhala & Tamil.
            </p>
          </ScrollReveal>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {[
              { label: 'Districts Covered', value: '25', icon: <MapPin size={18} /> },
              { label: 'Crop Classes', value: '14', icon: <Leaf size={18} /> },
              { label: 'Accuracy', value: '100%', icon: <Award size={18} /> },
              { label: 'Languages', value: '3', icon: <Globe size={18} /> },
            ].map((s, idx) => (
              <ScrollReveal key={s.label} delay={idx * 100}>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-lg hover:bg-white/10 transition-colors duration-300">
                  <div className="text-emerald-400 mb-2">{s.icon}</div>
                  <div className="text-2xl font-extrabold font-display">{s.value}</div>
                  <div className="text-xs text-slate-400 mt-1">{s.label}</div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA Section ══════════════════════════════════════════════════════ */}
      <section className="py-24 px-4 bg-white relative overflow-hidden">
        <div className="max-w-3xl mx-auto text-center">
          <ScrollReveal>
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl p-12 md:p-16 border border-emerald-100/80 shadow-xs relative overflow-hidden">
              {/* Subtle sprout watermark */}
              <div className="absolute -bottom-4 -right-4 opacity-[0.04] pointer-events-none">
                <Sprout size={200} />
              </div>

              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-800 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider mb-5">
                  <Heart size={14} /> Join the Community
                </div>
                <h2 className="text-3xl md:text-4xl font-extrabold font-display text-surface-900 mb-4 tracking-tight">
                  Ready to Digitize Your
                  <br />
                  <span className="text-emerald-700">Agricultural Operations?</span>
                </h2>
                <p className="text-surface-500 text-lg mb-8 leading-relaxed">
                  Join thousands of farmers, officers, and buyers already using Sara Ketha Harvest Hub to streamline agricultural management across Sri Lanka.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-4">
                  <Link
                    to="/register"
                    className="group inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-7 py-3.5 rounded-2xl font-bold text-base shadow-lg shadow-emerald-200 transition-all hover:-translate-y-0.5"
                  >
                    Create Free Account <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 bg-white text-surface-700 border border-surface-200 hover:bg-surface-50 px-7 py-3.5 rounded-2xl font-semibold text-base transition-all"
                  >
                    Sign In
                  </Link>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══ Footer ═══════════════════════════════════════════════════════════ */}
      <footer className="bg-slate-950 text-slate-400 py-16 px-4 relative overflow-hidden">
        {/* Subtle fireflies in footer */}
        <Fireflies count={8} color="rgba(52, 211, 153, 0.3)" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                  <Sprout size={20} className="text-white" />
                </div>
                <span className="text-white font-extrabold font-display tracking-tight text-base">Sara Ketha Harvest Hub</span>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed max-w-sm">
                A comprehensive agricultural collection centre management system built for Sri Lanka.
                Digitizing the entire supply chain — from farm to market.
              </p>
              <div className="flex items-center gap-4 mt-5 text-xs text-slate-600">
                <span className="flex items-center gap-1"><Lock size={12} /> SSL Encrypted</span>
                <span className="flex items-center gap-1"><Shield size={12} /> RBAC</span>
                <span className="flex items-center gap-1"><Globe size={12} /> Trilingual</span>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-white mb-4">Quick Links</h4>
              <ul className="space-y-2.5 text-sm">
                <li><a href="#services" className="hover:text-emerald-400 transition-colors">Services</a></li>
                <li><a href="#reliability" className="hover:text-emerald-400 transition-colors">Reliability</a></li>
                <li><Link to="/prices" className="hover:text-emerald-400 transition-colors">Crop Prices</Link></li>
                <li><Link to="/auctions" className="hover:text-emerald-400 transition-colors">Auctions</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-bold text-white mb-4">Technology</h4>
              <ul className="space-y-2.5 text-sm">
                <li className="flex items-center gap-2"><ChevronRight size={12} className="text-emerald-600" /> React + Vite + TailwindCSS</li>
                <li className="flex items-center gap-2"><ChevronRight size={12} className="text-emerald-600" /> Node.js + Express API</li>
                <li className="flex items-center gap-2"><ChevronRight size={12} className="text-emerald-600" /> Supabase PostgreSQL</li>
                <li className="flex items-center gap-2"><ChevronRight size={12} className="text-emerald-600" /> Java Weka ML Engine</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-600">
            <p>© {new Date().getFullYear()} Sara Ketha Harvest Hub — Sri Lanka. All rights reserved.</p>
            <p className="flex items-center gap-2">Currency: LKR · Weight: kg · Built with <Heart size={12} className="text-emerald-500" /></p>
          </div>
        </div>
      </footer>
    </div>
  );
};
