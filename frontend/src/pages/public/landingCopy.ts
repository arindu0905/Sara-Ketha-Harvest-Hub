export type Lang = 'en' | 'si' | 'ta';

type Copy = {
  nav: { prices: string; how: string; advisor: string };
  signIn: string; register: string;
  heroTag: string; heroTitle: string; heroSub: string; heroCta: string; heroPrices: string;
  todayCard: string;
  stepsTitle: string; steps: { t: string; d: string }[];
  pricesTitle: string; pricesSub: string; colCrop: string; colPay: string; colBuy: string; pricesEmpty: string; pricesAll: string;
  farmers: { t: string; items: string[] }; buyers: { t: string; items: string[] };
  advisorTitle: string; advisorSub: string; advisorChat: { q: string; a: string };
  ctaTitle: string; ctaSub: string;
  help: string; footer: string;
};

export const COPY: Record<Lang, Copy> = {
  en: {
    nav: { prices: 'Prices', how: 'How it works', advisor: 'Crop advisor' },
    signIn: 'Sign in', register: 'Register',
    heroTag: 'Collection centre system · Sri Lanka',
    heroTitle: 'From farm to buyer, fair and transparent.',
    heroSub: 'Book your delivery, get graded fairly and see your payment status online. No queues, no paper ledgers.',
    heroCta: 'Register as a farmer', heroPrices: "Today's prices",
    todayCard: 'Paid today',
    stepsTitle: 'Four simple steps',
    steps: [
      { t: 'Register', d: 'Sign up and get verified by your centre officer.' },
      { t: 'Deliver & weigh', d: 'Book a day, bring your harvest and watch it weighed.' },
      { t: 'Graded fairly', d: 'Quality inspectors grade it and you receive a receipt.' },
      { t: 'Get paid', d: 'Your payment is worked out from the grade and tracked until paid.' },
    ],
    pricesTitle: "Today's prices", pricesSub: 'Rs. per kg', colCrop: 'Crop', colPay: 'We pay', colBuy: 'Buyers pay',
    pricesEmpty: 'Prices will appear once your centre publishes them.', pricesAll: 'Full price list',
    farmers: { t: 'For farmers', items: ['Book deliveries from your phone', 'See every payment and receipt', 'Crop advice in your language'] },
    buyers: { t: 'For buyers', items: ['Order or bid on fresh produce', 'Track your deliveries', 'Invoices and receipts in one place'] },
    advisorTitle: 'Not sure what to plant? Ask the crop advisor.',
    advisorSub: 'Tell it your district and last crop. It scores each option and shows you why.',
    advisorChat: { q: 'Kurunegala, last crop paddy. What next?', a: 'Cowpea 88/100. It follows paddy well and suits your rainfall.' },
    ctaTitle: 'Join your centre on Harvest Hub',
    ctaSub: 'Farmers and buyers can register today.',
    help: 'Need help? Ask your collection centre officer.',
    footer: 'Saara Ketha Harvest Hub',
  },
  si: {
    nav: { prices: 'මිල ගණන්', how: 'ක්‍රියා කරන ආකාරය', advisor: 'බෝග උපදේශක' },
    signIn: 'ඇතුල් වන්න', register: 'ලියාපදිංචි වන්න',
    heroTag: 'එකතු කිරීමේ මධ්‍යස්ථාන පද්ධතිය · ශ්‍රී ලංකාව',
    heroTitle: 'ගොවිපළේ සිට ගැනුම්කරු දක්වා, සාධාරණව සහ විනිවිදභාවයෙන්.',
    heroSub: 'ඔබේ බෙදාහැරීම වෙන් කරගෙන, සාධාරණ ශ්‍රේණිගත කිරීමක් ලබා, ගෙවීම් තත්ත්වය මාර්ගගතව බලන්න. පෝලිම් නැත, කඩදාසි ලේඛන නැත.',
    heroCta: 'ගොවියෙකු ලෙස ලියාපදිංචි වන්න', heroPrices: 'අද මිල ගණන්',
    todayCard: 'අද ගෙවන මිල',
    stepsTitle: 'සරල පියවර හතරක්',
    steps: [
      { t: 'ලියාපදිංචි වන්න', d: 'ගිණුමක් සාදා මධ්‍යස්ථාන නිලධාරියාගෙන් තහවුරු කරගන්න.' },
      { t: 'ගෙනවුත් කිරන්න', d: 'දිනයක් වෙන් කර අස්වැන්න ගෙනවුත්, කිරා බලනවා දකින්න.' },
      { t: 'සාධාරණ ශ්‍රේණිගත කිරීම', d: 'ගුණාත්මක පරීක්ෂකයින් ශ්‍රේණිගත කර ඔබට ලදුපතක් ලැබේ.' },
      { t: 'ගෙවීම ලබාගන්න', d: 'ශ්‍රේණිය අනුව ගෙවීම ගණනය කර, ගෙවන තෙක් ලුහුබඳිනු ලැබේ.' },
    ],
    pricesTitle: 'අද මිල ගණන්', pricesSub: 'රු. කිලෝවකට', colCrop: 'බෝගය', colPay: 'අප ගෙවන්නේ', colBuy: 'ගැනුම්කරු ගෙවන්නේ',
    pricesEmpty: 'ඔබේ මධ්‍යස්ථානය මිල ප්‍රකාශයට පත් කළ විට මෙහි පෙන්වයි.', pricesAll: 'සම්පූර්ණ මිල ලැයිස්තුව',
    farmers: { t: 'ගොවීන් සඳහා', items: ['ඔබේ දුරකථනයෙන් බෙදාහැරීම් වෙන් කරන්න', 'සෑම ගෙවීමක් සහ ලදුපතක්ම බලන්න', 'ඔබේ භාෂාවෙන් බෝග උපදෙස්'] },
    buyers: { t: 'ගැනුම්කරුවන් සඳහා', items: ['නැවුම් අස්වැන්න ඇණවුම් කරන්න හෝ ලංසු තබන්න', 'ඔබේ බෙදාහැරීම් ලුහුබඳින්න', 'ඉන්වොයිස් සහ ලදුපත් එකම තැනක'] },
    advisorTitle: 'කුමක් වගා කරන්නදැයි සැකයි? බෝග උපදේශකයාගෙන් අසන්න.',
    advisorSub: 'ඔබේ දිස්ත්‍රික්කය සහ පසුගිය බෝගය කියන්න. එය එක් එක් විකල්පය ලකුණු කර හේතු පෙන්වයි.',
    advisorChat: { q: 'කුරුණෑගල, පසුගිය බෝගය වී. ඊළඟට?', a: 'කව්පි 88/100. වී පසුව ඉතා යෝග්‍යයි, ඔබේ වර්ෂාපතනයටත් ගැලපේ.' },
    ctaTitle: 'ඔබේ මධ්‍යස්ථානය සමඟ Harvest Hub හි එක්වන්න',
    ctaSub: 'ගොවීන්ට සහ ගැනුම්කරුවන්ට අදම ලියාපදිංචි විය හැක.',
    help: 'උදව් අවශ්‍යද? ඔබේ එකතු කිරීමේ මධ්‍යස්ථාන නිලධාරියාගෙන් අසන්න.',
    footer: 'සාරකේත අස්වැන්න මධ්‍යස්ථානය',
  },
  ta: {
    nav: { prices: 'விலைகள்', how: 'எவ்வாறு செயல்படுகிறது', advisor: 'பயிர் ஆலோசகர்' },
    signIn: 'உள்நுழை', register: 'பதிவு செய்',
    heroTag: 'சேகரிப்பு மைய அமைப்பு · இலங்கை',
    heroTitle: 'பண்ணையிலிருந்து வாங்குபவர் வரை, நியாயமாகவும் வெளிப்படையாகவும்.',
    heroSub: 'உங்கள் விநியோகத்தை முன்பதிவு செய்து, நியாயமான தரப்படுத்தலைப் பெற்று, கொடுப்பனவு நிலையை இணையத்தில் பாருங்கள். வரிசைகள் இல்லை, காகிதப் பதிவேடுகள் இல்லை.',
    heroCta: 'விவசாயியாகப் பதிவு செய்யுங்கள்', heroPrices: 'இன்றைய விலைகள்',
    todayCard: 'இன்று வழங்கும் விலை',
    stepsTitle: 'நான்கு எளிய படிகள்',
    steps: [
      { t: 'பதிவு செய்யுங்கள்', d: 'கணக்கை உருவாக்கி, மைய அதிகாரியிடம் சரிபார்ப்பு பெறுங்கள்.' },
      { t: 'கொண்டு வந்து எடை போடுங்கள்', d: 'ஒரு நாளை முன்பதிவு செய்து, அறுவடையைக் கொண்டு வந்து எடை பார்க்கலாம்.' },
      { t: 'நியாயமான தரம்', d: 'தர ஆய்வாளர்கள் தரப்படுத்தி, உங்களுக்கு ரசீது வழங்குவார்கள்.' },
      { t: 'கொடுப்பனவு பெறுங்கள்', d: 'தரத்தின்படி தொகை கணக்கிடப்பட்டு, செலுத்தும் வரை கண்காணிக்கப்படும்.' },
    ],
    pricesTitle: 'இன்றைய விலைகள்', pricesSub: 'ஒரு கிலோவிற்கு ரூ.', colCrop: 'பயிர்', colPay: 'நாங்கள் செலுத்துவது', colBuy: 'வாங்குபவர் செலுத்துவது',
    pricesEmpty: 'உங்கள் மையம் விலைகளை வெளியிட்டதும் இங்கே தோன்றும்.', pricesAll: 'முழு விலைப்பட்டியல்',
    farmers: { t: 'விவசாயிகளுக்கு', items: ['உங்கள் தொலைபேசியிலிருந்து விநியோகங்களை முன்பதிவு செய்யுங்கள்', 'ஒவ்வொரு கொடுப்பனவையும் ரசீதையும் பாருங்கள்', 'உங்கள் மொழியில் பயிர் ஆலோசனை'] },
    buyers: { t: 'வாங்குபவர்களுக்கு', items: ['புதிய விளைபொருட்களை ஆர்டர் செய்யுங்கள் அல்லது ஏலம் கேளுங்கள்', 'உங்கள் விநியோகங்களைக் கண்காணியுங்கள்', 'விலைப்பட்டியல்களும் ரசீதுகளும் ஒரே இடத்தில்'] },
    advisorTitle: 'எதை பயிரிடுவது என்று தெரியவில்லையா? பயிர் ஆலோசகரிடம் கேளுங்கள்.',
    advisorSub: 'உங்கள் மாவட்டத்தையும் கடைசிப் பயிரையும் சொல்லுங்கள். ஒவ்வொரு தேர்வுக்கும் மதிப்பெண் அளித்து காரணத்தையும் காட்டும்.',
    advisorChat: { q: 'குருநாகல், கடைசிப் பயிர் நெல். அடுத்து?', a: 'காராமணி 88/100. நெல்லுக்குப் பிறகு சிறந்தது, உங்கள் மழைக்கும் பொருந்தும்.' },
    ctaTitle: 'உங்கள் மையத்துடன் Harvest Hub-இல் இணையுங்கள்',
    ctaSub: 'விவசாயிகளும் வாங்குபவர்களும் இன்றே பதிவு செய்யலாம்.',
    help: 'உதவி தேவையா? உங்கள் சேகரிப்பு மைய அதிகாரியிடம் கேளுங்கள்.',
    footer: 'சாரகேத அறுவடை மையம்',
  },
};

export const GREETINGS = ['ආයුබෝවන්', 'வணக்கம்', 'Welcome'];

/** [emoji, English, Sinhala, Tamil] – common Sri Lankan crops for the marquee. */
export const CROPS: [string, string, string, string][] = [
  ['🌾', 'Paddy', 'වී', 'நெல்'], ['🥥', 'Coconut', 'පොල්', 'தேங்காய்'], ['🍃', 'Tea', 'තේ', 'தேயிலை'],
  ['🌶️', 'Chilli', 'මිරිස්', 'மிளகாய்'], ['🍌', 'Banana', 'කෙසෙල්', 'வாழை'], ['🥭', 'Mango', 'අඹ', 'மாம்பழம்'],
  ['🎃', 'Pumpkin', 'වට්ටක්කා', 'பூசணி'], ['🍆', 'Brinjal', 'වම්බටු', 'கத்தரிக்காய்'], ['🥕', 'Carrot', 'කැරට්', 'கேரட்'],
  ['🍋', 'Lime', 'දෙහි', 'எலுமிச்சை'], ['🍍', 'Pineapple', 'අන්නාසි', 'அன்னாசி'], ['🥔', 'Manioc', 'මඤ්ඤොක්කා', 'மரவள்ளி'],
];
