// ─── Sri Lankan Locale Utilities ─────────────────────────────────────────────
// Currency: LKR | Timezone: Asia/Colombo | Units: kg default

// ─── Currency ─────────────────────────────────────────────────────────────────

/** Format a number as Sri Lankan Rupees */
export function formatLKR(value: number | null | undefined, decimals = 2): string {
  if (value == null) return 'N/A';
  return new Intl.NumberFormat('en-LK', {
    style:                 'currency',
    currency:              'LKR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** Compact LKR (e.g. Rs. 1.25M, Rs. 450K) */
export function formatLKRCompact(value: number): string {
  if (value >= 1_000_000) return `Rs. ${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000)     return `Rs. ${(value / 1_000).toFixed(1)}K`;
  return formatLKR(value, 0);
}

// ─── Units ────────────────────────────────────────────────────────────────────

export type AuctionUnit = 'kg' | 'metric_ton' | 'bag' | 'crate' | 'piece';

const UNIT_LABELS: Record<AuctionUnit, { singular: string; plural: string; abbr: string }> = {
  kg:          { singular: 'Kilogram',    plural: 'Kilograms',    abbr: 'kg'  },
  metric_ton:  { singular: 'Metric Ton',  plural: 'Metric Tons',  abbr: 'MT'  },
  bag:         { singular: 'Bag',         plural: 'Bags',         abbr: 'bag' },
  crate:       { singular: 'Crate',       plural: 'Crates',       abbr: 'crt' },
  piece:       { singular: 'Piece',       plural: 'Pieces',       abbr: 'pcs' },
};

export function formatUnit(quantity: number, unit: AuctionUnit = 'kg'): string {
  const u = UNIT_LABELS[unit] ?? UNIT_LABELS.kg;
  return `${quantity.toLocaleString('en-LK')} ${quantity === 1 ? u.singular : u.plural}`;
}

export function unitAbbr(unit: AuctionUnit = 'kg'): string {
  return UNIT_LABELS[unit]?.abbr ?? 'kg';
}

// ─── Dates in Asia/Colombo timezone ──────────────────────────────────────────

const COLOMBO_TZ = 'Asia/Colombo';

/** Full date-time in Sri Lanka local time */
export function formatDateTimeSL(iso: string | null | undefined): string {
  if (!iso) return '–';
  return new Intl.DateTimeFormat('en-LK', {
    timeZone:     COLOMBO_TZ,
    year:         'numeric',
    month:        'short',
    day:          'numeric',
    hour:         '2-digit',
    minute:       '2-digit',
    hour12:       true,
  }).format(new Date(iso));
}

/** Date only in SL */
export function formatDateSL(iso: string | null | undefined): string {
  if (!iso) return '–';
  return new Intl.DateTimeFormat('en-LK', {
    timeZone: COLOMBO_TZ,
    year:     'numeric',
    month:    'short',
    day:      'numeric',
  }).format(new Date(iso));
}

/** Relative time (e.g. "in 3 hours", "2 days ago") */
export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '–';
  const diff = new Date(iso).getTime() - Date.now();
  const abs  = Math.abs(diff);
  const past = diff < 0;

  if (abs < 60_000)     return past ? 'just now'            : 'in a moment';
  if (abs < 3_600_000)  return past ? `${Math.floor(abs/60_000)}m ago`        : `in ${Math.floor(abs/60_000)}m`;
  if (abs < 86_400_000) return past ? `${Math.floor(abs/3_600_000)}h ago`     : `in ${Math.floor(abs/3_600_000)}h`;
  return past
    ? `${Math.floor(abs/86_400_000)}d ago`
    : `in ${Math.floor(abs/86_400_000)}d`;
}

// ─── Quality grade labels ─────────────────────────────────────────────────────

export const GRADE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  grade_a:  { label: 'Grade A',  color: 'text-green-700',  bg: 'bg-green-100'  },
  grade_b:  { label: 'Grade B',  color: 'text-blue-700',   bg: 'bg-blue-100'   },
  grade_c:  { label: 'Grade C',  color: 'text-yellow-700', bg: 'bg-yellow-100' },
  rejected: { label: 'Rejected', color: 'text-red-700',    bg: 'bg-red-100'    },
};

export function gradeLabel(grade: string) {
  return GRADE_LABELS[grade] ?? { label: grade, color: 'text-gray-700', bg: 'bg-gray-100' };
}

// ─── Auction status labels ────────────────────────────────────────────────────

export const AUCTION_STATUS: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  draft:            { label: 'Draft',             color: 'text-gray-600',   bg: 'bg-gray-100',    dot: 'bg-gray-400'   },
  scheduled:        { label: 'Scheduled',         color: 'text-blue-700',   bg: 'bg-blue-100',    dot: 'bg-blue-500'   },
  open:             { label: 'Live',              color: 'text-emerald-700',bg: 'bg-emerald-100', dot: 'bg-emerald-500'},
  paused:           { label: 'Paused',            color: 'text-yellow-700', bg: 'bg-yellow-100',  dot: 'bg-yellow-500' },
  closed:           { label: 'Closed',            color: 'text-gray-600',   bg: 'bg-gray-100',    dot: 'bg-gray-400'   },
  reserve_not_met:  { label: 'Reserve Not Met',   color: 'text-orange-700', bg: 'bg-orange-100',  dot: 'bg-orange-500' },
  awaiting_award:   { label: 'Awaiting Award',    color: 'text-purple-700', bg: 'bg-purple-100',  dot: 'bg-purple-500' },
  awarded:          { label: 'Awarded',           color: 'text-indigo-700', bg: 'bg-indigo-100',  dot: 'bg-indigo-500' },
  payment_pending:  { label: 'Payment Pending',   color: 'text-amber-700',  bg: 'bg-amber-100',   dot: 'bg-amber-500'  },
  paid:             { label: 'Paid',              color: 'text-emerald-700',bg: 'bg-emerald-100', dot: 'bg-emerald-500'},
  stock_allocated:  { label: 'Stock Allocated',   color: 'text-teal-700',   bg: 'bg-teal-100',    dot: 'bg-teal-500'   },
  preparing:        { label: 'Preparing',         color: 'text-sky-700',    bg: 'bg-sky-100',     dot: 'bg-sky-500'    },
  dispatched:       { label: 'Dispatched',        color: 'text-blue-700',   bg: 'bg-blue-100',    dot: 'bg-blue-500'   },
  delivered:        { label: 'Delivered',         color: 'text-green-700',  bg: 'bg-green-100',   dot: 'bg-green-500'  },
  completed:        { label: 'Completed',         color: 'text-green-800',  bg: 'bg-green-200',   dot: 'bg-green-600'  },
  cancelled:        { label: 'Cancelled',         color: 'text-red-700',    bg: 'bg-red-100',     dot: 'bg-red-500'    },
  payment_defaulted:{ label: 'Payment Defaulted', color: 'text-red-800',    bg: 'bg-red-200',     dot: 'bg-red-600'    },
  disputed:         { label: 'Disputed',          color: 'text-rose-700',   bg: 'bg-rose-100',    dot: 'bg-rose-500'   },
};

export function auctionStatusLabel(status: string) {
  return AUCTION_STATUS[status] ?? { label: status, color: 'text-gray-600', bg: 'bg-gray-100', dot: 'bg-gray-400' };
}

// ─── Sri Lankan phone validation ──────────────────────────────────────────────

/** Validates common Sri Lankan mobile and landline numbers */
export function isValidSLPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-()]/g, '');
  // Sri Lankan mobile: 07XXXXXXXX or +9407XXXXXXXX
  // Landline: 0XXXXXXXXX (9 or 10 digits)
  return /^(?:\+94|0094|0)?(?:7[0-9]{8}|[1-9][0-9]{7,8})$/.test(cleaned);
}

/** Validates NIC: old format (9 digits + V/X) or new format (12 digits) */
export function isValidSLNIC(nic: string): boolean {
  return /^[0-9]{9}[VvXx]$/.test(nic) || /^[0-9]{12}$/.test(nic);
}

// ─── Cultivation season helper ────────────────────────────────────────────────

export function getSriLankanSeasons(): { value: string; label: string }[] {
  const year = new Date().getFullYear();
  return [
    { value: `Yala ${year}`,           label: `Yala ${year} (May–Aug)` },
    { value: `Maha ${year}/${year + 1}`,label: `Maha ${year}/${year + 1} (Oct–Mar)` },
    { value: `Yala ${year - 1}`,       label: `Yala ${year - 1} (May–Aug)` },
    { value: `Maha ${year - 1}/${year}`,label: `Maha ${year - 1}/${year} (Oct–Mar)` },
  ];
}

// ─── Sri Lankan districts ─────────────────────────────────────────────────────

export const SL_DISTRICTS = [
  'Ampara','Anuradhapura','Badulla','Batticaloa','Colombo','Galle',
  'Gampaha','Hambantota','Jaffna','Kalutara','Kandy','Kegalle',
  'Kilinochchi','Kurunegala','Mannar','Matale','Matara','Monaragala',
  'Mullaitivu','Nuwara Eliya','Polonnaruwa','Puttalam','Ratnapura',
  'Trincomalee','Vavuniya',
] as const;

// ─── Payment method labels ────────────────────────────────────────────────────

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank_transfer: 'Bank Transfer',
  lanka_qr:      'LankaQR',
  card:          'Credit / Debit Card',
  cash:          'Authorized Cash',
  buyer_credit:  'Approved Buyer Credit',
};

// ─── i18n helpers (basic 3-language support) ──────────────────────────────────

export type Lang = 'en' | 'si' | 'ta';

export function getLang(): Lang {
  const stored = localStorage.getItem('hh_lang') as Lang | null;
  return stored ?? 'en';
}

export function setLang(lang: Lang) {
  localStorage.setItem('hh_lang', lang);
}

export function pickLang<T extends { en: string; si?: string; ta?: string }>(
  obj: T,
  lang: Lang = getLang()
): string {
  if (lang === 'si' && obj.si) return obj.si;
  if (lang === 'ta' && obj.ta) return obj.ta;
  return obj.en;
}
