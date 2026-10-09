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
        ? 'ආයුබෝවන්! මම ඔබගේ Sara Ketha Harvest Hub Bot සහායකයා වේ. 🌾\nඔබගේ ගොවිපල පිහිටි දිස්ත්‍රික්කය හෝ ප්‍රදේශය කුමක්ද?'
        : language === 'ta'
        ? 'வணக்கம்! நான் உங்கள் Sara Ketha Harvest Hub Bot ஆலோசனை உதவியாளராவேன். 🌾\nஉங்கள் பண்ணை எந்த மாவட்டத்தில் அமைந்துள்ளது?'
        : 'Hello! I am Sara Ketha Harvest Hub Bot. 🌾\nWhich district or region is your farm located in?';

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
              Sara Ketha Bot <Sparkles size={12} className="text-amber-300" />
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
      <div className="bg-gradient-to-r from-emerald-800 via-primary-800 to-emerald-900 p-3.5 text-white flex items-center justify-between shadow-md relative overflow-hidden shrink-0">
        <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-white/5 rounded-full blur-xl pointer-events-none" />

        <div className="flex items-center gap-2.5 relative z-10">
          <div className="relative w-9 h-9 bg-white/15 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 shadow-inner">
            <Bot size={20} className="text-emerald-300 animate-pulse" />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-emerald-900" />
          </div>
          <div>
            <h3 className="font-bold text-sm flex items-center gap-1.5 leading-tight tracking-tight">
              Sara Ketha Bot <Sparkles size={14} className="text-amber-300" />
            </h3>
            <span className="text-[10px] text-emerald-200/90 flex items-center gap-1 font-medium">
              <Activity size={10} className="text-emerald-400 animate-pulse" /> Transparent scoring model
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

      {/* ─── Messages Scroll Area ────────────────────────────────────────────── */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-surface-50">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col animate-msg-in ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[88%] rounded-2xl p-3.5 text-sm leading-relaxed transition-all duration-200 ${
                msg.sender === 'user'
                  ? 'bg-primary-600 text-white rounded-br-none shadow-sm'
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
                        {z}
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
                          className="btn-ghost text-xs py-2 px-2.5 rounded-xl border border-surface-200/80 hover:border-primary-500 hover:bg-primary-50 text-surface-800 text-left flex items-center gap-1.5 transition-all transform hover:-translate-y-0.5 active:translate-y-0 truncate cursor-pointer shadow-2xs"
                          title={distName}
                        >
                          <MapPin size={12} className="text-primary-600 shrink-0" />
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
                        : 'Or select a quick common option:'}
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {PREVIOUS_CROPS_OPTIONS.map((crop) => {
                        const cropName = crop[language as 'en' | 'si' | 'ta'] || crop.en;
                        return (
                          <button
                            key={crop.id}
                            onClick={() => handleSelectPrevCrop(crop)}
                            className="btn-ghost text-xs py-2 px-2.5 rounded-xl border border-surface-200 hover:border-primary-500 hover:bg-primary-50 text-surface-800 text-left flex items-center gap-1.5 transition-all transform hover:-translate-y-0.5 truncate cursor-pointer"
                          >
                            <History size={12} className="text-primary-600 shrink-0" />
                            <span className="truncate font-medium">{cropName}</span>
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
                  <div className="grid grid-cols-1 gap-1.5">
                    {SOIL_OPTIONS.map((opt) => {
                      const label = opt[language as 'en' | 'si' | 'ta'] || opt.en;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => submitSoil(opt.ph, label)}
                          className="btn-ghost text-xs py-2 px-2.5 rounded-xl border border-surface-200 hover:border-primary-500 hover:bg-primary-50 text-surface-800 text-left flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Droplets size={12} className="text-primary-600 shrink-0" />
                          <span className="font-medium">{label}</span>
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
                <div className="mt-3 space-y-2.5 animate-msg-in">
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

                  {msg.data.map((item: any) => (
                    <div
                      key={item.rank}
                      className="p-3.5 bg-gradient-to-br from-emerald-50/90 to-emerald-100/50 border border-emerald-200/90 rounded-2xl space-y-2 hover:border-emerald-500 hover:shadow-md transition-all duration-200 transform hover:-translate-y-0.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 bg-emerald-600 text-white font-bold text-xs rounded-full flex items-center justify-center shadow-xs">
                            #{item.rank}
                          </span>
                          <span className="font-bold text-emerald-950 text-base">{item.name}</span>
                          {item.ai_powered && (
                            <span title="AI recommended" className="w-4 h-4 bg-blue-500 text-white rounded-full flex items-center justify-center">
                              <Sparkles size={9} />
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-bold text-emerald-800 bg-white px-2.5 py-1 rounded-lg border border-emerald-200/80 shadow-2xs">
                          {item.suitability_score}/100 suitability
                        </span>
                      </div>

                      {/* Suitability Score Progress Bar */}
                      <div className="w-full bg-emerald-200/60 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-emerald-600 h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${item.suitability_score}%` }}
                        />
                      </div>

                      <p className="text-xs text-emerald-900/90 leading-snug pt-0.5">{item.rationale}</p>

                      {Array.isArray(item.score_breakdown) && (
                        <details className="text-[10px] text-emerald-900/80">
                          <summary className="cursor-pointer font-semibold">Why this score?</summary>
                          <ul className="mt-1 space-y-0.5">
                            {item.score_breakdown.map((f: any) => (
                              <li key={f.name}><b>{f.name.replace('_', ' ')}</b> {f.points}/{f.max} – {f.note}</li>
                            ))}
                          </ul>
                        </details>
                      )}

                      {/* Season / Water / Profitability Tags */}
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {item.season && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full border border-amber-200">
                            📅 {item.season}
                          </span>
                        )}
                        {item.water_need && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded-full border border-sky-200">
                            💧 {item.water_need} water
                          </span>
                        )}
                        {item.profitability && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold bg-violet-100 text-violet-800 px-1.5 py-0.5 rounded-full border border-violet-200">
                            💰 {item.profitability} profit
                          </span>
                        )}
                      </div>

                      {/* Direct Action Link */}
                      <div className="pt-1.5 flex items-center justify-end">
                        <Link
                          to="/farmer/register-crop"
                          onClick={onClose}
                          className="inline-flex items-center gap-1 text-2xs font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-200/60 hover:bg-emerald-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                        >
                          <span>Register {item.name}</span>
                          <ArrowRight size={11} />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>
          </div>
        ))}

        {/* Animated Neural Typing Indicator */}
        {isSubmitting && (
          <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-surface-200 shadow-xs max-w-[85%] animate-msg-in">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-emerald-600 rounded-full animate-dot-1" />
              <span className="w-2 h-2 bg-emerald-600 rounded-full animate-dot-2" />
              <span className="w-2 h-2 bg-emerald-600 rounded-full animate-dot-3" />
            </div>
            <span className="text-xs font-semibold text-surface-600">
              Gemini AI analyzing optimal crop patterns for your region...
            </span>
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
