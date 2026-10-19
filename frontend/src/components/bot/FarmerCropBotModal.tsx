import React, { useState, useEffect, useRef } from 'react';
import { Bot, X, Send, Sparkles, Sprout, MapPin, History, RefreshCw, Search, Minimize2, Maximize2, ChevronDown, ArrowRight, Activity, Filter, CheckCircle2, Droplets } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import apiClient from '../../services/apiClient';

interface Message {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  type?: 'prompt' | 'input_district' | 'input_prev_crop' | 'input_soil' | 'recommendations';
  data?: any;
  aiPowered?: boolean;
  aiSource?: 'gemini' | 'fallback';
  districtProfile?: any;
}

export interface DistrictOption {
  id: string;
  en: string;
  si: string;
  ta: string;
  zone?: 'High Country' | 'Mid Country' | 'Dry Zone' | 'Wet Zone';
}

export const SRI_LANKA_DISTRICTS: DistrictOption[] = [
  { id: 'Ampara', en: 'Ampara', si: 'අම්පාර', ta: 'அம்பாறை', zone: 'Dry Zone' },
  { id: 'Anuradhapura', en: 'Anuradhapura', si: 'අනුරාධපුරය', ta: 'அனுராதபுரம்', zone: 'Dry Zone' },
  { id: 'Badulla', en: 'Badulla', si: 'බදුල්ල', ta: 'பதுளை', zone: 'High Country' },
  { id: 'Batticaloa', en: 'Batticaloa', si: 'මඩකලපුව', ta: 'மட்டக்களப்பு', zone: 'Dry Zone' },
  { id: 'Colombo', en: 'Colombo', si: 'කොළඹ', ta: 'கொழும்பு', zone: 'Wet Zone' },
  { id: 'Dambulla', en: 'Dambulla', si: 'දඹුල්ල', ta: 'தம்புள்ளை', zone: 'Mid Country' },
  { id: 'Galle', en: 'Galle', si: 'ගාල්ල', ta: 'காலி', zone: 'Wet Zone' },
  { id: 'Gampaha', en: 'Gampaha', si: 'ගම්පහ', ta: 'கம்பஹா', zone: 'Wet Zone' },
  { id: 'Hambantota', en: 'Hambantota', si: 'හම්බන්තොට', ta: 'அம்பாந்தோட்டை', zone: 'Dry Zone' },
  { id: 'Jaffna', en: 'Jaffna', si: 'යාපනය', ta: 'யாழ்ப்பாணம்', zone: 'Dry Zone' },
  { id: 'Kalutara', en: 'Kalutara', si: 'කළුතර', ta: 'களுத்துறை', zone: 'Wet Zone' },
  { id: 'Kandy', en: 'Kandy', si: 'මහනුවර', ta: 'கண்டி', zone: 'Mid Country' },
  { id: 'Kegalle', en: 'Kegalle', si: 'කෑගල්ල', ta: 'கேகாலை', zone: 'Mid Country' },
  { id: 'Kilinochchi', en: 'Kilinochchi', si: 'කිලිනොච්චිය', ta: 'கிளிநொச்சி', zone: 'Dry Zone' },
  { id: 'Kurunegala', en: 'Kurunegala', si: 'කුරුණෑගල', ta: 'குருநாகல்', zone: 'Mid Country' },
  { id: 'Mannar', en: 'Mannar', si: 'මන්නාරම', ta: 'மன்னார்', zone: 'Dry Zone' },
  { id: 'Matale', en: 'Matale', si: 'මාතලේ', ta: 'மாத்தளை', zone: 'Mid Country' },
  { id: 'Matara', en: 'Matara', si: 'මාතර', ta: 'மாத்தறை', zone: 'Wet Zone' },
  { id: 'Moneragala', en: 'Moneragala', si: 'මොණරාගල', ta: 'மொணராகலை', zone: 'Dry Zone' },
  { id: 'Mullaitivu', en: 'Mullaitivu', si: 'මුලතිවු', ta: 'முல்லைத்தீவு', zone: 'Dry Zone' },
  { id: 'Nuwara Eliya', en: 'Nuwara Eliya', si: 'නුවරඑළිය', ta: 'நுவரெலியா', zone: 'High Country' },
  { id: 'Polonnaruwa', en: 'Polonnaruwa', si: 'පොළොන්නරුව', ta: 'பொலன்னறுவை', zone: 'Dry Zone' },
  { id: 'Puttalam', en: 'Puttalam', si: 'පුත්තලම', ta: 'புத்தளம்', zone: 'Dry Zone' },
  { id: 'Ratnapura', en: 'Ratnapura', si: 'රත්නපුරය', ta: 'இரத்தினபுரி', zone: 'Mid Country' },
  { id: 'Trincomalee', en: 'Trincomalee', si: 'ත්‍රිකුණාමලය', ta: 'திருகோணமலை', zone: 'Dry Zone' },
  { id: 'Vavuniya', en: 'Vavuniya', si: 'වවුනියාව', ta: 'வவுனியா', zone: 'Dry Zone' },
];

export interface CropOption {
  id: string;
  en: string;
  si: string;
  ta: string;
}

const PREVIOUS_CROPS_OPTIONS: CropOption[] = [
  { id: 'Rice', en: 'Rice / Paddy', si: 'ගොයම් / සහල්', ta: 'நெல் / அரிசி' },
  { id: 'Tomato', en: 'Tomato', si: 'තක්කාලි', ta: 'தக்காளி' },
  { id: 'Carrot', en: 'Carrot', si: 'කැරට්', ta: 'கரட்' },
  { id: 'Cabbage', en: 'Cabbage', si: 'ගෝවා', ta: 'முட்டைக்கோஸ்' },
  { id: 'Beans', en: 'Green Beans', si: 'බෝංචි', ta: 'பீன்ஸ்' },
  { id: 'Potato', en: 'Potato', si: 'අර්තාපල්', ta: 'உருளைக்கிழங்கு' },
  { id: 'Onion', en: 'Onion', si: 'ලූනු', ta: 'வெங்காயம்' },
  { id: 'None', en: 'None / First Time', si: 'මුකුත් නැත / පළමු වතාව', ta: 'எதுவுமில்லை' },
];

// Names for the crops that can appear in a district's list (the first seven are also in PREVIOUS_CROPS_OPTIONS)
const CROP_LABELS: Record<string, CropOption> = {
  Chilli: { id: 'Chilli', en: 'Chilli', si: 'මිරිස්', ta: 'மிளகாய்' },
  Brinjal: { id: 'Brinjal', en: 'Brinjal', si: 'වම්බටු', ta: 'கத்தரிக்காய்' },
  Okra: { id: 'Okra', en: 'Okra', si: 'බණ්ඩක්කා', ta: 'வெண்டைக்காய்' },
  Bittergourd: { id: 'Bittergourd', en: 'Bitter Gourd', si: 'කරවිල', ta: 'பாகற்காய்' },
  Ginger: { id: 'Ginger', en: 'Ginger', si: 'ඉඟුරු', ta: 'இஞ்சி' },
  Maize: { id: 'Maize', en: 'Maize', si: 'ඉරිඟු', ta: 'சோளம்' },
  Cowpea: { id: 'Cowpea', en: 'Cowpea', si: 'කව්පි', ta: 'காராமணி' },
  Pumpkin: { id: 'Pumpkin', en: 'Pumpkin', si: 'වට්ටක්කා', ta: 'பூசணி' },
  Watermelon: { id: 'Watermelon', en: 'Watermelon', si: 'කොමඩු', ta: 'தர்பூசணி' },
  Capsicum: { id: 'Capsicum', en: 'Capsicum', si: 'කැප්සිකම්', ta: 'குடைமிளகாய்' },
  Sesame: { id: 'Sesame', en: 'Sesame', si: 'තල', ta: 'எள்' },
  Sugarcane: { id: 'Sugarcane', en: 'Sugarcane', si: 'උක්', ta: 'கரும்பு' },
  Leeks: { id: 'Leeks', en: 'Leeks', si: 'ලීක්ස්', ta: 'லீக்ஸ்' },
  Beetroot: { id: 'Beetroot', en: 'Beetroot', si: 'බීට්රූට්', ta: 'பீட்ரூட்' },
  'Leafy Vegetables': { id: 'Leafy Vegetables', en: 'Leafy Vegetables', si: 'කොළ පලා', ta: 'கீரை' },
};
const cropOptionFor = (id: string): CropOption =>
  PREVIOUS_CROPS_OPTIONS.find((o) => o.id === id) || CROP_LABELS[id] || { id, en: id, si: id, ta: id };

const CROP_EMOJI: Record<string, string> = {
  Rice: '🌾', Tomato: '🍅', Carrot: '🥕', Cabbage: '🥬', Beans: '🫘', Potato: '🥔', Onion: '🧅', Chilli: '🌶️', Brinjal: '🍆',
  Okra: '🌿', Bittergourd: '🥒', Ginger: '🫚', Maize: '🌽', Cowpea: '🫛', Pumpkin: '🎃', Watermelon: '🍉', Capsicum: '🫑',
  Sesame: '🌱', Sugarcane: '🎋', Leeks: '🧄', Beetroot: '🟣', 'Leafy Vegetables': '🥬', None: '🌱',
};
const cropEmoji = (name: string): string =>
  CROP_EMOJI[name] || Object.entries(CROP_EMOJI).find(([k]) => name.toLowerCase().includes(k.toLowerCase()))?.[1] || '🌱';

const ZONE_STYLE: Record<string, { emoji: string; bar: string }> = {
  'High Country': { emoji: '🏔️', bar: 'border-l-sky-500' },
  'Mid Country': { emoji: '⛰️', bar: 'border-l-emerald-500' },
  'Dry Zone': { emoji: '☀️', bar: 'border-l-amber-500' },
  'Wet Zone': { emoji: '🌧️', bar: 'border-l-indigo-500' },
};

const SOIL_STYLE: Record<string, { emoji: string; tone: string }> = {
  acidic: { emoji: '🍋', tone: 'from-amber-50 to-yellow-100 border-amber-200' },
  slightly_acidic: { emoji: '🍃', tone: 'from-lime-50 to-green-100 border-lime-200' },
  neutral: { emoji: '🌿', tone: 'from-emerald-50 to-teal-100 border-emerald-200' },
  alkaline: { emoji: '🧪', tone: 'from-sky-50 to-blue-100 border-sky-200' },
  unknown: { emoji: '🤔', tone: 'from-surface-50 to-surface-100 border-surface-200' },
};

const MEDALS = ['🥇', '🥈', '🥉'];

const STEPS = [
  { emoji: '📍', en: 'Location', si: 'ස්ථානය', ta: 'இடம்' },
  { emoji: '🌾', en: 'Last crop', si: 'පසුගිය බෝගය', ta: 'முந்தைய பயிர்' },
  { emoji: '🧪', en: 'Soil', si: 'පස', ta: 'மண்' },
  { emoji: '✨', en: 'Results', si: 'ප්‍රතිඵල', ta: 'முடிவுகள்' },
];

/** Circular suitability gauge. */
const ScoreRing: React.FC<{ score: number }> = ({ score }) => {
  const r = 20, c = 2 * Math.PI * r;
  const colour = score >= 75 ? '#059669' : score >= 55 ? '#d97706' : '#ea580c';
  return (
    <div className="relative w-14 h-14 shrink-0">
      <svg viewBox="0 0 48 48" className="w-14 h-14 -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" stroke="#e5e7eb" strokeWidth="5" />
        <circle cx="24" cy="24" r={r} fill="none" stroke={colour} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(100, score)) / 100)} style={{ transition: 'stroke-dashoffset 0.9s ease' }} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[13px] font-extrabold" style={{ color: colour }}>{score}</span>
    </div>
  );
};

/** One-shot celebration when the recommendations appear. */
const Confetti: React.FC = () => (
  <div className="absolute inset-x-0 top-0 h-0 overflow-visible pointer-events-none z-10" aria-hidden>
    {Array.from({ length: 22 }).map((_, i) => (
      <span key={i} className="bot-confetti"
        style={{ left: `${(i * 4.7) % 100}%`, animationDelay: `${(i % 7) * 0.12}s`, background: ['#10b981', '#f59e0b', '#38bdf8', '#f472b6', '#a78bfa'][i % 5] }} />
    ))}
  </div>
);

interface SoilOption { id: string; ph: number | null; en: string; si: string; ta: string }
const SOIL_OPTIONS: SoilOption[] = [
  { id: 'acidic', ph: 5.0, en: 'Acidic (pH below 5.5)', si: 'අම්ල (pH 5.5 ට අඩු)', ta: 'அமிலத் தன்மை (pH 5.5க்குக் கீழ்)' },
  { id: 'slightly_acidic', ph: 6.0, en: 'Slightly acidic (pH 5.5–6.5)', si: 'මඳ අම්ල (pH 5.5–6.5)', ta: 'சற்று அமிலம் (pH 5.5–6.5)' },
  { id: 'neutral', ph: 6.8, en: 'Neutral (pH 6.5–7.2)', si: 'උදාසීන (pH 6.5–7.2)', ta: 'நடுநிலை (pH 6.5–7.2)' },
  { id: 'alkaline', ph: 7.8, en: 'Alkaline (pH above 7.2)', si: 'ක්ෂාරීය (pH 7.2 ට වැඩි)', ta: 'காரத் தன்மை (pH 7.2க்கு மேல்)' },
  { id: 'unknown', ph: null, en: "I don't know", si: 'මම නොදනිමි', ta: 'எனக்குத் தெரியாது' },
];

export const FarmerCropBotModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { language, setLanguage } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [step, setStep] = useState<'greeting' | 'district' | 'prev_crop' | 'soil' | 'loading' | 'done'>('greeting');
  const [soilPhInput, setSoilPhInput] = useState('');
  const [soilPhError, setSoilPhError] = useState('');
  const [selectedDistrictId, setSelectedDistrictId] = useState('');
  const [selectedDistrictName, setSelectedDistrictName] = useState('');
  // crops typically grown in the chosen district (null = not loaded -> show the general list)
  const [districtCrops, setDistrictCrops] = useState<string[] | null>(null);
  const [selectedPrevCrop, setSelectedPrevCrop] = useState('');
  const [customCropInput, setCustomCropInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [districtSearch, setDistrictSearch] = useState('');
  const [zoneFilter, setZoneFilter] = useState<string>('All');

  // Window Actions state (Minimize & Expand)
  const [isMinimized, setIsMinimized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      setIsMinimized(false);
      startConversation();
    }
  }, [isOpen, language]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSubmitting, districtSearch, zoneFilter]);

  const startConversation = () => {
    setStep('district');
    setSelectedDistrictId('');
    setSelectedDistrictName('');
    setSelectedPrevCrop('');
    setCustomCropInput('');
    setSoilPhInput('');
    setSoilPhError('');
    setDistrictSearch('');
    setZoneFilter('All');

    const greetingText =
      language === 'si'
        ? 'ආයුබෝවන්! මම ඔබගේ Saara Ketha Harvest Hub Bot සහායකයා වේ. 🌾\nඔබගේ ගොවිපල පිහිටි දිස්ත්‍රික්කය හෝ ප්‍රදේශය කුමක්ද?'
        : language === 'ta'
        ? 'வணக்கம்! நான் உங்கள் Saara Ketha Harvest Hub Bot ஆலோசனை உதவியாளராவேன். 🌾\nஉங்கள் பண்ணை எந்த மாவட்டத்தில் அமைந்துள்ளது?'
        : 'Hello! I am Saara Ketha Harvest Hub Bot. 🌾\nWhich district or region is your farm located in?';

    setMessages([
      {
        id: '1',
        sender: 'bot',
        text: greetingText,
        type: 'input_district',
      },
    ]);
  };

  const handleSelectDistrict = (distItem: DistrictOption) => {
    const localizedName = distItem[language as 'en' | 'si' | 'ta'] || distItem.en;
    setSelectedDistrictId(distItem.id);
    setSelectedDistrictName(localizedName);
    setDistrictCrops(null);
    apiClient.get('/bot/district-crops', { params: { district: distItem.id } })
      .then((r) => setDistrictCrops(r.data?.data?.crops || null))
      .catch(() => setDistrictCrops(null));

    const userMsg: Message = { id: Date.now().toString(), sender: 'user', text: localizedName };
    
    const botPromptText =
      language === 'si'
        ? `නියමයි (${localizedName})! පසුගිය කන්නයේ ඔබ වගා කළ බෝගය කුමක්ද?`
        : language === 'ta'
        ? `மிக நன்று (${localizedName})! கடந்த பருவத்தில் நீங்கள் சாகுபடி செய்த பயிர் எது?`
        : `Great (${localizedName})! What crop did you cultivate in your previous harvesting season?`;

    const nextBotMsg: Message = {
      id: (Date.now() + 1).toString(),
      sender: 'bot',
      text: botPromptText,
      type: 'input_prev_crop',
    };

    setMessages((prev) => [...prev, userMsg, nextBotMsg]);
    setStep('prev_crop');
  };

  const handleSelectPrevCrop = (cropInput: string | CropOption) => {
    const cropId = typeof cropInput === 'string' ? cropInput : cropInput.id;
    const localizedCropName = typeof cropInput === 'string'
      ? cropInput
      : (cropInput[language as 'en' | 'si' | 'ta'] || cropInput.en);

    setSelectedPrevCrop(cropId);
    setCustomCropInput('');

    const userMsg: Message = { id: Date.now().toString(), sender: 'user', text: localizedCropName };
    const soilPrompt: Message = {
      id: (Date.now() + 1).toString(),
      sender: 'bot',
      text:
        language === 'si'
          ? 'හොඳයි! ඔබේ පසේ තත්ත්වය (pH) කොහොමද? ඔබ දන්නේ නැත්නම් "මම නොදනිමි" තෝරන්න.'
          : language === 'ta'
          ? 'நல்லது! உங்கள் மண்ணின் தன்மை (pH) எப்படி உள்ளது? தெரியவில்லை என்றால் "எனக்குத் தெரியாது" என்பதைத் தேர்ந்தெடுக்கவும்.'
          : 'Good! What is your soil like (pH)? Choose "I don\'t know" if you are not sure.',
      type: 'input_soil',
    };
    setMessages((prev) => [...prev, userMsg, soilPrompt]);
    setStep('soil');
  };

  const submitSoil = (ph: number | null, label: string) => {
    const userMsg: Message = { id: Date.now().toString(), sender: 'user', text: label };
    setSoilPhError('');
    setSoilPhInput('');
    runRecommendation(selectedPrevCrop, ph, label, userMsg);
  };

  const handleSoilPhSubmit = () => {
    const n = Number(soilPhInput);
    if (!soilPhInput.trim() || !Number.isFinite(n) || n < 3 || n > 10) {
      setSoilPhError(
        language === 'si' ? 'pH අගය 3 සහ 10 අතර සංඛ්‍යාවක් විය යුතුය'
        : language === 'ta' ? 'pH மதிப்பு 3 முதல் 10 வரையிலான எண்ணாக இருக்க வேண்டும்'
        : 'pH must be a number between 3 and 10'
      );
      return;
    }
    submitSoil(n, `pH ${n}`);
  };

  const runRecommendation = async (cropId: string, soilPh: number | null, soilLabel: string, userMsg: Message) => {
    const processingMsgText =
      language === 'si'
        ? 'ස්තූතියි! ඔබ සඳහා වඩාත්ම සුදුසු බෝග නිර්දේශ ගණනය කරමින් පවතී...'
        : language === 'ta'
        ? 'நன்றி! உங்களுக்கான சிறந்த பயிர் பரிந்துரைகள் கணக்கிடப்படுகின்றன...'
        : 'Analyzing agronomic features to calculate optimal crop predictions...';

    const loadingMsg: Message = {
      id: (Date.now() + 1).toString(),
      sender: 'bot',
      text: processingMsgText,
    };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setIsSubmitting(true);
    setStep('loading');

    try {
      const response = await apiClient.post('/bot/recommend', {
        district: selectedDistrictId,
        previous_crop: cropId,
        soil_ph: soilPh ?? undefined,
        soil_condition: soilLabel,
        lang: language,
      });

      const recData = response.data?.data;

      const recMsg: Message = {
        id: (Date.now() + 2).toString(),
        sender: 'bot',
        text: recData?.header || 'Here are your recommended optimal crops:',
        type: 'recommendations',
        data: recData?.recommendations || [],
        aiPowered: recData?.ai_powered || false,
        aiSource: recData?.ai_source || 'fallback',
        districtProfile: recData?.district_profile || null,
      };

      setMessages((prev) => [...prev, recMsg]);
      setStep('done');
    } catch (err) {
      const errorText =
        language === 'si'
          ? 'නිර්දේශ ලබා ගැනීමේදී දෝෂයක් සිදු විය. කරුණාකර නැවත උත්සාහ කරන්න.'
          : language === 'ta'
          ? 'பரிந்துரைகளைப் பெறுவதில் பிழை ஏற்பட்டது. மீண்டும் முயற்சிக்கவும்.'
          : 'Unable to process crop recommendation. Please try again.';

      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), sender: 'bot', text: errorText },
      ]);
      setStep('done');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredDistricts = SRI_LANKA_DISTRICTS.filter((dist) => {
    const q = districtSearch.trim().toLowerCase();
    const matchesSearch = !q || (
      dist.en.toLowerCase().includes(q) ||
      dist.si.toLowerCase().includes(q) ||
      dist.ta.toLowerCase().includes(q)
    );
    const matchesZone = zoneFilter === 'All' || dist.zone === zoneFilter;
    return matchesSearch && matchesZone;
  });

  if (!isOpen) return null;

  // Render Minimized Floating Pill Action Widget
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 animate-bot-slide-up">
        <button
          onClick={() => setIsMinimized(false)}
          className="group flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-emerald-800 via-primary-800 to-emerald-900 text-white rounded-2xl shadow-2xl border border-emerald-500/40 hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer"
        >
          <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-white/15 backdrop-blur-md">
            <Bot size={18} className="text-emerald-300 animate-pulse" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-emerald-950 animate-ping" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-emerald-950" />
          </div>
          <div className="text-left">
            <p className="font-bold text-xs flex items-center gap-1 leading-tight">
              Saara Ketha Bot <Sparkles size={12} className="text-amber-300" />
            </p>
            <p className="text-[10px] text-emerald-200/80 font-medium">Smart Crop Advisor • Active</p>
          </div>
          <ChevronDown size={16} className="text-emerald-200 group-hover:translate-y-[-2px] transition-transform rotate-180 ml-1" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 w-full shadow-2xl rounded-3xl bg-white border border-surface-200 overflow-hidden flex flex-col transition-all duration-300 ease-in-out animate-bot-slide-up ${
        isExpanded ? 'max-w-2xl h-[720px]' : 'max-w-lg h-[620px]'
      }`}
    >
      {/* ─── Header bar with rich actions & transitions ───────────────────────── */}
      <div className="bg-gradient-to-br from-emerald-700 via-teal-700 to-emerald-900 p-3.5 text-white flex items-center justify-between shadow-md relative overflow-hidden shrink-0">
        <div className="absolute -right-8 -bottom-8 w-28 h-28 bg-amber-300/15 rounded-full blur-xl pointer-events-none" />
        <div className="absolute -left-6 -top-8 w-24 h-24 bg-emerald-300/10 rounded-full blur-xl pointer-events-none" />
        <span className="absolute right-24 top-1 text-lg opacity-20 bot-float pointer-events-none">🍃</span>
        <span className="absolute right-40 bottom-0 text-sm opacity-20 bot-float pointer-events-none" style={{ animationDelay: '0.8s' }}>🌾</span>

        <div className="flex items-center gap-2.5 relative z-10">
          <div className="relative w-9 h-9 bg-white/15 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 shadow-inner">
            <span className="text-xl bot-wave">🌱</span>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-emerald-900" />
          </div>
          <div>
            <h3 className="font-bold text-sm flex items-center gap-1.5 leading-tight tracking-tight">
              Saara Ketha Bot <Sparkles size={14} className="text-amber-300" />
            </h3>
            <span className="text-[10px] text-emerald-200/90 flex items-center gap-1 font-medium">
              <Activity size={10} className="text-emerald-300 animate-pulse" /> Your friendly farming buddy
            </span>
          </div>
        </div>

        {/* Header Control Buttons */}
        <div className="flex items-center gap-1.5 relative z-10">
          {/* Language Selector */}
          <div className="flex items-center bg-white/10 rounded-xl p-0.5 border border-white/15 text-[11px] font-medium">
            <button
              onClick={() => setLanguage('en')}
              className={`px-1.5 py-0.5 rounded-lg transition-all ${
                language === 'en' ? 'bg-white text-emerald-900 font-bold shadow-xs' : 'text-emerald-100 hover:text-white'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage('si')}
              className={`px-1.5 py-0.5 rounded-lg transition-all ${
                language === 'si' ? 'bg-white text-emerald-900 font-bold shadow-xs' : 'text-emerald-100 hover:text-white'
              }`}
            >
              සිං
            </button>
            <button
              onClick={() => setLanguage('ta')}
              className={`px-1.5 py-0.5 rounded-lg transition-all ${
                language === 'ta' ? 'bg-white text-emerald-900 font-bold shadow-xs' : 'text-emerald-100 hover:text-white'
              }`}
            >
              தமி
            </button>
          </div>

          {/* Minimize Window Action */}
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 hover:bg-white/15 rounded-xl transition-all text-emerald-200 hover:text-white active:scale-90"
            title="Minimize Window"
          >
            <Minimize2 size={15} />
          </button>

          {/* Expand / Restore Window Action */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 hover:bg-white/15 rounded-xl transition-all text-emerald-200 hover:text-white active:scale-90"
            title={isExpanded ? 'Restore Normal View' : 'Expand View'}
          >
            <Maximize2 size={15} />
          </button>

          {/* Reset Conversation Action */}
          <button
            onClick={startConversation}
            className="p-1.5 hover:bg-white/15 rounded-xl transition-all text-emerald-200 hover:text-white active:rotate-180 duration-300"
            title="Reset Conversation"
          >
            <RefreshCw size={15} />
          </button>

          {/* Close Modal Action */}
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-red-500/30 rounded-xl transition-all text-emerald-200 hover:text-white active:scale-90"
            title="Close Bot"
          >
            <X size={17} />
          </button>
        </div>
      </div>

      {/* ─── Progress steps ──────────────────────────────────────────────────── */}
      <div className="px-4 py-2.5 bg-white border-b border-surface-100 shrink-0">
        {(() => {
          const current = step === 'greeting' || step === 'district' ? 0 : step === 'prev_crop' ? 1 : step === 'soil' ? 2 : step === 'loading' ? 3 : 4;
          return (
            <div className="flex items-center">
              {STEPS.map((st, i) => {
                const done = i < current, active = i === current;
                return (
                  <React.Fragment key={st.en}>
                    <div className="flex flex-col items-center gap-0.5 min-w-[54px]">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-base border-2 transition-all ${
                        done ? 'bg-emerald-500 border-emerald-500 text-white' : active ? 'bg-emerald-50 border-emerald-500 shadow-md scale-110' : 'bg-surface-50 border-surface-200 grayscale opacity-60'}`}>
                        {done ? '✓' : st.emoji}
                      </span>
                      <span className={`text-[10px] font-semibold ${active ? 'text-emerald-700' : done ? 'text-emerald-600' : 'text-surface-400'}`}>
                        {st[language as 'en' | 'si' | 'ta'] || st.en}
                      </span>
                    </div>
                    {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 rounded-full mb-4 mx-1 ${i < current ? 'bg-emerald-500' : 'bg-surface-200'}`} />}
                  </React.Fragment>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* ─── Messages Scroll Area ────────────────────────────────────────────── */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bot-canvas">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col animate-msg-in ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            {msg.sender === 'bot' && (
              <span className="text-[10px] font-semibold text-emerald-700 mb-1 ml-1 flex items-center gap-1">
                <span className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center text-[9px]">🌱</span> Saara Ketha
              </span>
            )}
            <div
              className={`max-w-[88%] rounded-2xl p-3.5 text-sm leading-relaxed transition-all duration-200 ${
                msg.sender === 'user'
                  ? 'bg-gradient-to-br from-emerald-600 to-teal-600 text-white rounded-br-none shadow-md'
                  : 'bg-white text-surface-900 border border-surface-200/90 rounded-bl-none shadow-card'
              }`}
            >
              <p className="whitespace-pre-line">{msg.text}</p>

              {/* District Options with Zone Tabs & Search */}
              {msg.type === 'input_district' && step === 'district' && (
                <div className="mt-3 pt-3 border-t border-surface-100 space-y-2.5 animate-msg-in">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-surface-600 uppercase tracking-wider block">
                      {language === 'si'
                        ? 'ශ්‍රී ලංකාවේ දිස්ත්‍රික්ක (සියල්ල 25):'
                        : language === 'ta'
                        ? 'இலங்கை மாவட்டங்கள் (அனைத்தும் 25):'
                        : 'Sri Lanka Districts (All 25):'}
                    </span>
                  </div>

                  {/* Agro Zone Filter Tabs */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 text-2xs scrollbar-hide">
                    {['All', 'High Country', 'Mid Country', 'Dry Zone', 'Wet Zone'].map((z) => (
                      <button
                        key={z}
                        onClick={() => setZoneFilter(z)}
                        className={`px-2 py-1 rounded-lg font-semibold transition-all shrink-0 cursor-pointer ${
                          zoneFilter === z
                            ? 'bg-primary-600 text-white shadow-xs'
                            : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                        }`}
                      >
                        {z === 'All' ? '🇱🇰 All' : `${ZONE_STYLE[z]?.emoji ?? ''} ${z}`}
                      </button>
                    ))}
                  </div>

                  {/* Search input for districts */}
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-2.5 text-surface-400" />
                    <input
                      type="text"
                      placeholder={
                        language === 'si'
                          ? 'දිස්ත්‍රික්කය සොයන්න...'
                          : language === 'ta'
                          ? 'மாவட்டத்தைத் தேடுங்கள்...'
                          : 'Search district...'
                      }
                      value={districtSearch}
                      onChange={(e) => setDistrictSearch(e.target.value)}
                      className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-surface-200 focus:outline-none focus:border-primary-500 bg-surface-50 transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-52 overflow-y-auto pr-1">
                    {filteredDistricts.map((dist) => {
                      const distName = dist[language as 'en' | 'si' | 'ta'] || dist.en;
                      return (
                        <button
                          key={dist.id}
                          onClick={() => handleSelectDistrict(dist)}
                          className={`bot-pop text-xs py-2 px-2.5 rounded-xl border border-surface-200/80 border-l-4 ${ZONE_STYLE[dist.zone || 'Wet Zone'].bar} bg-white hover:bg-emerald-50 hover:shadow-md text-surface-800 text-left flex items-center gap-1.5 transition-all transform hover:-translate-y-0.5 active:translate-y-0 truncate cursor-pointer`}
                          title={distName}
                        >
                          <span className="text-sm shrink-0">{ZONE_STYLE[dist.zone || 'Wet Zone'].emoji}</span>
                          <span className="truncate font-medium">{distName}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Previous Crop Selection Options */}
              {msg.type === 'input_prev_crop' && step === 'prev_crop' && (
                <div className="mt-3 pt-3 border-t border-surface-100 space-y-3 animate-msg-in">
                  {/* Farmer Custom Crop Text Entry */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-surface-600 uppercase tracking-wider block">
                      {language === 'si'
                        ? 'වගා කළ බෝගය ඇතුළත් කරන්න:'
                        : language === 'ta'
                        ? 'சாகுபடி செய்த பயிரைத் தட்டச்சு செய்க:'
                        : 'Type your cultivated crop:'}
                    </span>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (customCropInput.trim()) {
                          handleSelectPrevCrop(customCropInput.trim());
                        }
                      }}
                      className="flex items-center gap-1.5"
                    >
                      <input
                        type="text"
                        placeholder={
                          language === 'si'
                            ? 'ඕනෑම බෝගයක් ඇතුළත් කරන්න (උදා: මිරිස්, බටු, බඩඉරිඟු)...'
                            : language === 'ta'
                            ? 'பயிரின் பெயரைத் தட்டச்சு செய்க (எ.கா: மிளகாய், கத்தரி)...'
                            : 'Enter any crop (e.g. Chilli, Brinjal, Maize, Pumpkin)...'
                        }
                        value={customCropInput}
                        onChange={(e) => setCustomCropInput(e.target.value)}
                        className="flex-1 text-xs px-3 py-2 rounded-xl border border-surface-300 focus:outline-none focus:border-primary-600 focus:ring-1 focus:ring-primary-600 bg-white"
                        autoFocus
                      />
                      <button
                        type="submit"
                        disabled={!customCropInput.trim()}
                        className="btn-primary text-xs py-2 px-3 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white font-semibold shrink-0 flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <span>{language === 'si' ? 'යවන්න' : language === 'ta' ? 'அனுப்பு' : 'Submit'}</span>
                        <Send size={12} />
                      </button>
                    </form>
                  </div>

                  {/* Quick Crop Options */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-medium text-surface-400 block">
                      {language === 'si'
                        ? 'හෝ පහත ඉක්මන් තේරීම් වලින් එකක් තෝරන්න:'
                        : language === 'ta'
                        ? 'அல்லது விரைவுத் தேர்வுகளில் ஒன்றைத் தேர்ந்தெடுக்கவும்:'
                        : districtCrops && districtCrops.length
                        ? `Or pick a crop commonly grown in ${selectedDistrictName}:`
                        : 'Or select a quick common option:'}
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {[...(districtCrops && districtCrops.length ? districtCrops.map(cropOptionFor) : PREVIOUS_CROPS_OPTIONS.filter((o) => o.id !== 'None')), PREVIOUS_CROPS_OPTIONS.find((o) => o.id === 'None')!].map((crop) => {
                        const cropName = crop[language as 'en' | 'si' | 'ta'] || crop.en;
                        return (
                          <button
                            key={crop.id}
                            onClick={() => handleSelectPrevCrop(crop)}
                            className="bot-pop group flex flex-col items-center justify-center gap-1 py-2.5 px-1.5 rounded-2xl border border-surface-200 bg-white hover:border-emerald-500 hover:bg-emerald-50 hover:shadow-md transition-all transform hover:-translate-y-0.5 cursor-pointer"
                          >
                            <span className="text-2xl group-hover:scale-125 transition-transform">{cropEmoji(crop.id)}</span>
                            <span className="text-[11px] font-semibold text-surface-800 text-center leading-tight">{cropName}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Soil condition options */}
              {msg.type === 'input_soil' && step === 'soil' && (
                <div className="mt-3 pt-3 border-t border-surface-100 space-y-3 animate-msg-in">
                  <div className="grid grid-cols-2 gap-2">
                    {SOIL_OPTIONS.map((opt) => {
                      const label = opt[language as 'en' | 'si' | 'ta'] || opt.en;
                      const look = SOIL_STYLE[opt.id] || SOIL_STYLE.unknown;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => submitSoil(opt.ph, label)}
                          className={`bot-pop flex items-center gap-2 text-left p-2.5 rounded-2xl border bg-gradient-to-br ${look.tone} hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer ${opt.id === 'unknown' ? 'col-span-2' : ''}`}
                        >
                          <span className="text-2xl shrink-0">{look.emoji}</span>
                          <span className="text-[11px] font-semibold text-surface-800 leading-snug">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <form onSubmit={(e) => { e.preventDefault(); handleSoilPhSubmit(); }} className="space-y-1">
                    <span className="text-[11px] font-medium text-surface-400 block">
                      {language === 'si' ? 'හෝ නිවැරදි pH අගය ඇතුළත් කරන්න (3–10):' : language === 'ta' ? 'அல்லது துல்லியமான pH மதிப்பை உள்ளிடவும் (3–10):' : 'Or enter your exact pH (3–10):'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number" step="0.1" min="3" max="10"
                        value={soilPhInput}
                        onChange={(e) => { setSoilPhInput(e.target.value); setSoilPhError(''); }}
                        className="flex-1 text-xs px-3 py-2 rounded-xl border border-surface-300 focus:outline-none focus:border-primary-600 focus:ring-1 focus:ring-primary-600 bg-white"
                      />
                      <button type="submit" disabled={!soilPhInput.trim()} className="btn-primary text-xs py-2 px-3 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white font-semibold shrink-0 flex items-center gap-1 cursor-pointer">
                        <span>{language === 'si' ? 'යවන්න' : language === 'ta' ? 'அனுப்பு' : 'Submit'}</span>
                        <Send size={12} />
                      </button>
                    </div>
                    {soilPhError && <p className="text-[11px] text-red-600">{soilPhError}</p>}
                  </form>
                </div>
              )}

              {/* Crop Recommendations Cards with Actions */}
              {msg.type === 'recommendations' && msg.data && (
                <div className="mt-3 space-y-2.5 animate-msg-in relative">
                  <Confetti />
                  {/* AI Source Badge */}
                  <div className="flex items-center gap-2 mb-1">
                    {(msg as any).aiPowered ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                        <Sparkles size={10} /> Powered by Google Gemini AI
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                        <Activity size={10} /> Agro-Climatic Decision Engine
                      </span>
                    )}
                  </div>

                  {/* District Profile Summary */}
                  {(msg as any).districtProfile && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-2.5 mb-2 text-[10px] text-blue-800 space-y-0.5">
                      <p className="font-bold text-blue-900">{(msg as any).districtProfile.zone}</p>
                      <p>🌧 Rainfall: {(msg as any).districtProfile.rainfall} · 🏔 {(msg as any).districtProfile.altitude}</p>
                      <p>🌡 {(msg as any).districtProfile.climate}</p>
                    </div>
                  )}

                  {msg.data.map((item: any, idx: number) => (
                    <div
                      key={item.rank}
                      className={`bot-pop relative p-3.5 rounded-2xl space-y-2.5 border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
                        item.rank === 1
                          ? 'bg-gradient-to-br from-amber-50 via-emerald-50 to-emerald-100 border-amber-300 shadow-md'
                          : 'bg-gradient-to-br from-emerald-50/90 to-emerald-100/50 border-emerald-200/90'}`}
                      style={{ animationDelay: `${idx * 0.12}s` }}
                    >
                      {item.rank === 1 && (
                        <span className="absolute -top-2 left-3 text-[10px] font-extrabold bg-amber-400 text-amber-950 px-2 py-0.5 rounded-full shadow">⭐ BEST MATCH</span>
                      )}
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-white border border-emerald-200 shadow-inner flex items-center justify-center text-3xl shrink-0 bot-float" style={{ animationDelay: `${idx * 0.3}s` }}>
                          {cropEmoji(item.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-lg leading-none">{MEDALS[item.rank - 1] || `#${item.rank}`}</span>
                            <span className="font-bold text-emerald-950 text-base truncate">{item.name}</span>
                            {item.ai_powered && (
                              <span title="AI recommended" className="w-4 h-4 bg-blue-500 text-white rounded-full flex items-center justify-center shrink-0"><Sparkles size={9} /></span>
                            )}
                          </div>
                          <p className="text-[10px] font-semibold text-emerald-700 mt-0.5">
                            {item.suitability_score >= 75 ? 'Excellent fit' : item.suitability_score >= 55 ? 'Good fit' : 'Possible, with care'}
                          </p>
                        </div>
                        <ScoreRing score={item.suitability_score} />
                      </div>

                      <p className="text-xs text-emerald-900/90 leading-snug">{item.rationale}</p>

                      {Array.isArray(item.score_breakdown) && (
                        <details className="text-[10px] text-emerald-900/80 bg-white/60 rounded-xl px-2.5 py-1.5 border border-emerald-100">
                          <summary className="cursor-pointer font-semibold">🔍 Why this score?</summary>
                          <div className="mt-1.5 space-y-1.5">
                            {item.score_breakdown.map((f: any) => (
                              <div key={f.name}>
                                <div className="flex justify-between"><b className="capitalize">{f.name.replace('_', ' ')}</b><span>{f.points}/{f.max}</span></div>
                                <div className="h-1 rounded-full bg-emerald-100 overflow-hidden"><div className="h-1 rounded-full bg-emerald-500" style={{ width: `${(f.points / f.max) * 100}%` }} /></div>
                                <p className="text-[9px] text-emerald-800/70">{f.note}</p>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}

                      <div className="flex flex-wrap gap-1">
                        {item.season && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">📅 {item.season}</span>
                        )}
                        {item.water_need && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full border border-sky-200">💧 {item.water_need} water</span>
                        )}
                        {item.profitability && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-violet-100 text-violet-800 px-2 py-0.5 rounded-full border border-violet-200">💰 {item.profitability} profit</span>
                        )}
                      </div>

                      <Link
                        to={`/farmer/crops/register?crop=${encodeURIComponent(item.name)}`}
                        onClick={onClose}
                        className="flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 px-3 py-2 rounded-xl shadow-md transition-all cursor-pointer"
                      >
                        <Sprout size={13} /> <span>Register {item.name}</span> <ArrowRight size={12} />
                      </Link>
                    </div>
                  ))}
                </div>
              )}

            </div>
          </div>
        ))}

        {/* Growing-plant loading animation */}
        {isSubmitting && (
          <div className="flex items-center gap-3 bg-white p-3.5 rounded-2xl border border-emerald-200 shadow-md max-w-[88%] animate-msg-in">
            <div className="flex items-end gap-1 text-2xl">
              <span className="bot-grow" style={{ animationDelay: '0s' }}>🌱</span>
              <span className="bot-grow" style={{ animationDelay: '0.25s' }}>🌿</span>
              <span className="bot-grow" style={{ animationDelay: '0.5s' }}>🌳</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-emerald-800">
                {language === 'si' ? 'ඔබේ බෝග නිර්දේශ වගා කරමින්…' : language === 'ta' ? 'உங்கள் பயிர் பரிந்துரைகளை வளர்த்து வருகிறோம்…' : 'Growing your crop recommendations…'}
              </p>
              <div className="mt-1.5 h-1.5 rounded-full bot-shimmer" />
              <p className="text-[10px] text-surface-400 mt-1">
                {language === 'si' ? 'දිස්ත්‍රික්කය, පස සහ බෝග මාරුව විශ්ලේෂණය කරමින්' : language === 'ta' ? 'மாவட்டம், மண் மற்றும் பயிர் சுழற்சியை ஆராய்கிறது' : 'Checking your district, soil and crop rotation'}
              </p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ─── Footer Bar ──────────────────────────────────────────────────────── */}
      <div className="p-3 bg-white border-t border-surface-200 flex items-center justify-between text-xs text-surface-500 shrink-0">
        <span className="flex items-center gap-1.5 font-medium text-2xs text-surface-600">
          <Sparkles size={12} className="text-blue-500" />
          <span>Gemini AI + Agro-Climatic Decision Engine</span>
        </span>
        {step === 'done' && (
          <button
            onClick={startConversation}
            className="btn-secondary btn-xs inline-flex items-center gap-1 text-primary-700 hover:bg-primary-50 transition-colors cursor-pointer"
          >
            <RefreshCw size={11} /> Start New Session
          </button>
        )}
      </div>
    </div>
  );
};
