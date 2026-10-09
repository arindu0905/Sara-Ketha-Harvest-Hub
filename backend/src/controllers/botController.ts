import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/AppError';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { rankCrops, parseSoilPh, ScoredCrop } from '../services/cropAdvisor';

// ─── Gemini AI Client ────────────────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
let genAI: GoogleGenerativeAI | null = null;
if (GEMINI_API_KEY && !GEMINI_API_KEY.includes('placeholder')) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface LocalizedString { en: string; si: string; ta: string; }

interface DistrictProfile {
  zone: string;
  rainfall: string;        // mm per year
  altitude: string;        // meters
  soilTypes: string[];
  seasons: string[];       // Maha / Yala / All-year
  climate: string;
  primaryCrops: string[];  // Best suited crops for this district
  avoidAfter: Record<string, string[]>; // crop rotation rules: avoidAfter[previousCrop] = [bad next crops]
  topRecommendations: Record<string, string[]>; // previousCrop → recommended next crops
  defaultRecommendations: string[]; // no previous crop context
}

// ─── Conversation Prompts ────────────────────────────────────────────────────
const PROMPTS = {
  greeting: {
    en: 'Hello! I am Sara Ketha Harvest Hub Bot. 🌾\nI\'ll analyze your district\'s agro-climatic zone, soil type, and crop rotation history to recommend the most profitable crops.\nWhich district is your farm located in?',
    si: 'ආයුබෝවන්! මම Sara Ketha Harvest Hub Bot. 🌾\nඔබගේ දිස්ත්‍රික්කයේ කාලගුණය, පස් ස්වභාවය සහ පූර්ව වගා ඉතිහාසය විශ්ලේෂණය කර වඩාත් ලාභදායී බෝග නිර්දේශ කරන්නෙමි.\nඔබගේ ගොවිපල ඇති දිස්ත්‍රික්කය කුමක්ද?',
    ta: 'வணக்கம்! நான் Sara Ketha Harvest Hub Bot. 🌾\nஉங்கள் மாவட்டத்தின் தட்பவெப்பம், மண் வகை மற்றும் பயிர் சுழற்சி வரலாற்றை ஆய்வு செய்து சிறந்த பயிர்களை பரிந்துரைப்பேன்.\nஉங்கள் பண்ணை எந்த மாவட்டத்தில் உள்ளது?',
  },
  askPreviousCrop: {
    en: 'Great! What crop did you cultivate in your previous harvesting season? (This helps me ensure proper crop rotation for your soil health)',
    si: 'ඉතා හොඳයි! ඔබ පසුගිය කන්නයේ වගා කළ බෝගය කුමක්ද? (නිවැරදි වගා කාරාවිල් සලසා ගැනීමට මෙය ඉවහල් වේ)',
    ta: 'மிக நன்று! கடந்த பருவத்தில் நீங்கள் சாகுபடி செய்த பயிர் எது? (சரியான பயிர் சுழற்சியை உறுதி செய்ய இது உதவும்)',
  },
  recommendationHeader: {
    en: '🌾 Based on your agro-climatic zone analysis, soil profile, and crop rotation science, here are the top recommended crops for your next season:',
    si: '🌾 ඔබගේ කෘෂිකාලගුණ කලාප විශ්ලේෂණය, පස් ස්වභාවය සහ වගා කාරාවිල් විද්‍යාව අනුව ඊළඟ කන්නය සඳහා ඉහළම බෝග නිර්දේශ:',
    ta: '🌾 உங்கள் வேளாண் தட்பவெப்ப மண்டல பகுப்பாய்வு, மண் சுயவிவரம் மற்றும் பயிர் சுழற்சி அறிவியலின் அடிப்படையில் அடுத்த பருவத்திற்கான சிறந்த பயிர்கள்:',
  },
};

// ─── Comprehensive Crop Knowledge Base ───────────────────────────────────────
const CROP_INFO: Record<string, {
  en: string; si: string; ta: string;
  rationale: LocalizedString;
  season: string;
  waterNeed: string;
  profitability: string;
}> = {
  Tomato: {
    en: 'Tomato', si: 'තක්කාලි', ta: 'தக்காளி',
    season: 'Both Maha & Yala', waterNeed: 'Moderate', profitability: 'High',
    rationale: {
      en: 'High year-round market demand at HarvestHub collection centres. Excellent cash crop with 2–3 harvests per season in well-drained loamy soils.',
      si: 'HarvestHub එකතු කිරීමේ මධ්‍යස්ථානවල ඉහළ ඉල්ලුම. හොඳින් ජලාපවහනය වන ලෝම් පසෙහි කන්නයකදී අස්වැන්න 2-3 වාරයක් ලබාගත හැකි ලාභදායී නිෂ්පාදනයකි.',
      ta: 'HarvestHub அறுவடை மையங்களில் அதிக தேவை. நன்கு வடிகால் கொண்ட மண்ணில் பருவமொன்றில் 2-3 முறை அறுவடை செய்யலாம்.',
    },
  },
  Carrot: {
    en: 'Carrot', si: 'කැරට්', ta: 'கரட்',
    season: 'Maha (Oct–Feb)', waterNeed: 'Low-Moderate', profitability: 'Very High',
    rationale: {
      en: 'Premium price in upcountry cool climate. Deep sandy-loam soils of Nuwara Eliya and Badulla produce superior quality carrots with high export demand.',
      si: 'නුවරඑළිය සහ බදුල්ල දිස්ත්‍රික්කවල ගැඹුරු වැලි-ලෝම් පසෙහි ලෝකෝත්තර ගුණාත්මක කැරට් නිෂ්පාදනය සිදු වේ. අපනයන ඉල්ලුම ඉහළයි.',
      ta: 'மேட்டுநில குளிர் காலநிலையில் உயர் விலை கிடைக்கும். நுவரெலியா மற்றும் பதுளையின் ஆழமான மண்ணில் உயர் தர கேரட் உற்பத்தி செய்யலாம்.',
    },
  },
  Cabbage: {
    en: 'Cabbage', si: 'ගෝවා', ta: 'முட்டைக்கோஸ்',
    season: 'Maha (Oct–Mar)', waterNeed: 'Moderate', profitability: 'High',
    rationale: {
      en: 'Thrives in cool elevated regions. High local consumption and stable prices at collection centres. Grows best after legume crops that fix nitrogen.',
      si: 'සීතල ඉහළ ප්‍රදේශ සඳහා ශ්‍රේෂ්ඨ බෝගය. ධාන්‍ය වගාවෙන් පසු නයිට්‍රජන්-සමෘද්ධ පසෙහි හොඳ අස්වැන්නක් ලැබේ.',
      ta: 'குளிர் உயர் பகுதிகளில் சிறப்பாக வளரும். பருப்பு பயிர்களுக்கு பிறகு நைட்ரஜன் செறிந்த மண்ணில் சிறந்த மகசூல் தரும்.',
    },
  },
  Beans: {
    en: 'Green Beans', si: 'බෝංචි', ta: 'பீன்ஸ்',
    season: 'Both Maha & Yala', waterNeed: 'Moderate', profitability: 'High',
    rationale: {
      en: 'Essential nitrogen-fixing rotation crop. Restores soil fertility after heavy feeders like tomato, maize, or cabbage. High export value from upcountry regions.',
      si: 'නයිට්‍රජන් ස්ථාවරීකරණ කිරීමේ ශ්‍රේෂ්ඨ බෝගය. තක්කාලි, ගොයම් ඉවත් කිරීමෙන් පසු පස් සෞඛ්‍යය නැවත ලබා දෙයි. අපනයන වටිනාකම ඉහළයි.',
      ta: 'நைட்ரஜன் நிர்ணயிக்கும் சிறந்த பயிர். தக்காளி, சோளம் போன்றவற்றுக்கு பிறகு மண் வளத்தை மீட்டெடுக்கும். ஏற்றுமதி மதிப்பு அதிகம்.',
    },
  },
  Onion: {
    en: 'Red / Big Onion', si: 'ලූනු / ලොකු ලූනු', ta: 'வெங்காயம் / பெரிய வெங்காயம்',
    season: 'Yala (May–Aug)', waterNeed: 'Low', profitability: 'Very High',
    rationale: {
      en: 'Dry-zone specialty with very high market value. Sandy loam soils of Dambulla, Matale and Jaffna produce premium big onions with low disease pressure.',
      si: 'දඹුල්ල, මාතලේ, යාපනය යන ප්‍රදේශවල වැලිලොම් පසෙහි ශ්‍රේෂ්ඨ ලොකු ලූනු නිෂ්පාදනය. රෝග පීඩනය අඩු, වෙළඳ මිල ඉහළයි.',
      ta: 'தம்புள்ளை, மாத்தளை, யாழ்ப்பாணம் பகுதிகளில் மணல் கலந்த மண்ணில் தரமான பெரிய வெங்காயம் உற்பத்தி. சந்தை விலை மிக அதிகம்.',
    },
  },
  Rice: {
    en: 'Paddy Rice (Samba/Nadu)', si: 'ගොයම් / සහල් (සාම්බා/නාදු)', ta: 'நெல் / அரிசி (சம்பா/நாடு)',
    season: 'Both Maha & Yala', waterNeed: 'Very High', profitability: 'Moderate',
    rationale: {
      en: 'Staple crop ideal for low-lying clay flats with water retention. Maha season (Oct–Feb) provides best yields in wet zone districts. Government guaranteed price ensures stability.',
      si: 'ජල රඳවා ගන්නා මැටි පස් ඇති පහත් ඉඩම් සඳහා ශ්‍රේෂ්ඨ. මහ කන්නය (ඔක්-පෙබ) ශ්‍රේෂ්ඨ අස්වැන්න ලබා දෙයි. රජය ගෙවන මිල ස්ථාවරත්වය ලබා දෙයි.',
      ta: 'நீர் தேங்கும் களிமண் நிலங்களுக்கு ஏற்ற பயிர். மகா பருவம் (அக்-பிப்) அதிக மகசூல் தரும். அரசு உத்தரவாத விலை நிலைத்தன்மை தரும்.',
    },
  },
  Potato: {
    en: 'Potato', si: 'අර්තාපල්', ta: 'உருளைக்கிழங்கு',
    season: 'Maha (Oct–Jan)', waterNeed: 'Moderate', profitability: 'Very High',
    rationale: {
      en: 'Exclusively suited for cool upcountry zones above 1200m. Nuwara Eliya\'s volcanic red loam produces superior tubers. Premium import-substitution crop with high processing demand.',
      si: 'මීටර් 1200 ට ඉහළ සීතල කලාපවලට පමණක් ගැළපේ. නුවරඑළියේ ගිනිකඳු රතු ලෝම් පසෙහි ශ්‍රේෂ්ඨ දඩු නිපදවේ. ආනයන ආදේශනය සහ කර්මාන්ත ඉල්ලුම ඉහළයි.',
      ta: '1200 மீட்டருக்கு மேலான குளிர் மண்டலங்களுக்கு மட்டுமே ஏற்றது. நுவரெலியாவின் சிவப்பு மண்ணில் தரமான கிழங்கு கிடைக்கும். இறக்குமதி மாற்று பயிர் - அதிக தேவை.',
    },
  },
  Pumpkin: {
    en: 'Pumpkin (Wattakka)', si: 'වට්ටක්කා', ta: 'பூசணிகாய்',
    season: 'Yala (Apr–Aug)', waterNeed: 'Low', profitability: 'Moderate',
    rationale: {
      en: 'Excellent drought-tolerant crop for Yala season in dry and intermediate zones. Very low maintenance with good yield on poor soils. Stable price at all collection centres.',
      si: 'නියං-ඔරොත්තු දෙන ශ්‍රේෂ්ඨ බෝගය. යාල කන්නයේ (අප්‍රේල්-අගෝස්තු) දුර්වල පස්වල පවා හොඳ අස්වැන්නක් ලැබේ. නඩත්තු ආදායම අඩු.',
      ta: 'வறட்சியை தாங்கும் சிறந்த பயிர். யாழ பருவத்தில் மோசமான மண்ணிலும் நல்ல மகசூல். குறைந்த பராமரிப்பு, நிலையான விலை.',
    },
  },
  Chilli: {
    en: 'Green Chilli / Capsicum', si: 'අමු මිරිස් / කැප්සිකම්', ta: 'மிளகாய் / குடைமிளகாய்',
    season: 'Both Maha & Yala', waterNeed: 'Low-Moderate', profitability: 'Very High',
    rationale: {
      en: 'Premium cash crop for intermediate and dry zones. Sandy loam soils ensure good drainage preventing root rot. Consistent year-round demand with high price stability.',
      si: 'මැදිහත් සහ වියළි කලාප සඳහා ශ්‍රේෂ්ඨ ව්‍යාපාරික බෝගය. වැලි-ලෝම් පස් මූල කුණාට හේතු නොවේ. ඉහළ ස්ථාවර වෙළඳ මිල.',
      ta: 'இடைநிலை மற்றும் உலர் மண்டலங்களுக்கான சிறந்த பண பயிர். மணல் கலந்த மண் வேர் அழுகலை தடுக்கும். நிலையான சந்தை விலை.',
    },
  },
  Brinjal: {
    en: 'Brinjal / Eggplant', si: 'වම්බටු', ta: 'கத்தரிக்காய்',
    season: 'Both Maha & Yala', waterNeed: 'Moderate', profitability: 'Moderate-High',
    rationale: {
      en: 'Versatile crop suited to a wide range of soil types from intermediate to wet zones. Continuous bearing habit allows multiple harvests. Strong local market demand.',
      si: 'විවිධ පස් වර්ගවලට ගැළපෙන බෝගය. අඛණ්ඩ ගෙඩි ලෙස ලෑස්ති වීම නිසා කන්නයකදී කිහිප වාරයක් අස්වැන්න නෙළිය හැකිය.',
      ta: 'பல்வேறு மண் வகைகளில் சாகுபடி செய்யலாம். தொடர்ச்சியான காய்காய்க்கும் தன்மை அதிக மகசூலை அனுமதிக்கும்.',
    },
  },
  Maize: {
    en: 'Maize / Corn', si: 'බඩඉරිඟු', ta: 'சோளம்',
    season: 'Both Maha & Yala', waterNeed: 'Moderate', profitability: 'Moderate',
    rationale: {
      en: 'Dual-purpose crop for human consumption and poultry/livestock feed. Excellent rotation partner restoring soil structure after paddy. Lower input cost with stable assured market.',
      si: 'මානව පරිභෝජනය සහ කුකුළු/ගවමස් ආහාර සඳහා ද්විත්ව-අරමුණු ඇති බෝගය. ගොයම් වගාවෙන් පසු සුදුසු කාරාවිල් බෝගය.',
      ta: 'மனித உணவு மற்றும் கோழி/கால்நடை தீவனமாக பயன்படும். நெல் சாகுபடிக்கு பிறகு சிறந்த சுழற்சி பயிர்.',
    },
  },
  Watermelon: {
    en: 'Watermelon', si: 'වෝටර්මෙලන් / කොමඩු', ta: 'தர்பூசணி',
    season: 'Yala (Apr–Jul)', waterNeed: 'Low-Moderate', profitability: 'High',
    rationale: {
      en: 'Excellent high-value Yala season crop for dry zone sandy soils. Large water storage capacity in sandy soils supports drought tolerance. Very high market price in summer.',
      si: 'වියළි කලාප වැලි පසෙහි ශ්‍රේෂ්ඨ යාල කන්නය (අප්‍රේල්-ජූලි) බෝගය. නියං-ඔරොත්තු දීමේ හැකියාව ඉහළ. ගිම්හාන කාලයේ ඉහළ වෙළඳ මිල.',
      ta: 'உலர் மண்டல மணல் மண்ணில் யாழ பருவத்தில் சிறந்த அதிக மதிப்புள்ள பயிர். கோடை காலத்தில் மிக அதிக சந்தை விலை.',
    },
  },
  Cowpea: {
    en: 'Cowpea (Mung / Black-eyed)', si: 'මෑ / කව්පි', ta: 'தட்டைப் பயறு / காராமணி',
    season: 'Yala (Apr–Jul)', waterNeed: 'Very Low', profitability: 'Moderate-High',
    rationale: {
      en: 'Critical nitrogen-fixing legume for soil restoration in dry zones. Short duration (60–70 days) allows quick turnover. Drought-resistant with stable year-round demand.',
      si: 'වියළි කලාප සඳහා ශ්‍රේෂ්ඨ නයිට්‍රජන් ස්ථාවරීකරණ රනිල් ශාකය. කෙටි කාලීන (දින 60-70) ඉක්මන් ලාභ ලැබිය හැකිය. නියං ඔරොත්තු දේ.',
      ta: 'உலர் மண்டல மண் மீட்புக்கான முக்கிய நைட்ரஜன் நிர்ணய பயிர். குறுகிய காலம் (60-70 நாட்கள்) விரைவான வருவாய். வறட்சி எதிர்ப்பு.',
    },
  },
  Bittergourd: {
    en: 'Bittergourd / Bitter Melon', si: 'කරවිල', ta: 'பாகற்காய்',
    season: 'Yala (Apr–Sep)', waterNeed: 'Moderate', profitability: 'High',
    rationale: {
      en: 'High-value medicinal vegetable with consistent demand. Trellis cultivation maximises land use efficiency. Performs well in intermediate zone loam soils.',
      si: 'ඉහළ ඖෂධීය වටිනාකමක් ඇති එළවළු. කඩු (ට්‍රෙලිස්) මත වගා කිරීමෙන් ඉඩම් භාවිතය ශ්‍රේෂ්ඨ කළ හැකිය. මැදිහත් කලාප ලෝම් පසෙහි ශ්‍රේෂ්ඨ.',
      ta: 'அதிக மதிப்புள்ள மருத்துவ காய்கறி. தூல பயிராக வளர்க்கும்போது நிலப் பயன்பாடு அதிகரிக்கும். இடைநிலை மண்ணில் சிறந்தது.',
    },
  },
  Capsicum: {
    en: 'Capsicum / Bell Pepper', si: 'කැප්සිකම් / සීනි මිරිස්', ta: 'குடைமிளகாய்',
    season: 'Maha (Oct–Feb)', waterNeed: 'Moderate', profitability: 'Very High',
    rationale: {
      en: 'Premium export-grade vegetable in high demand from hotels and supermarkets. Cool mid-country climate of Kandy and Kegalle produces excellent colour and shelf life.',
      si: 'හෝටල් සහ සුපිරිළෙඳසැල් ඉල්ලෙන ශ්‍රේෂ්ඨ අපනයන-ශ්‍රේණි එළවළු. මහනුවර, කෑගල්ල සීතල කාලගුණය ශ්‍රේෂ්ඨ වර්ණය සහ කාලය ලබා දෙයි.',
      ta: 'ஹோட்டல்கள் மற்றும் சூப்பர் மார்கெட்களில் அதிக ஏற்றுமதி தேவை. கண்டி, கேகாலையின் குளிர் காலநிலை சிறந்த நிறம் மற்றும் ஆயுளை தரும்.',
    },
  },
  Ginger: {
    en: 'Ginger', si: 'ඉඟුරු', ta: 'இஞ்சி',
    season: 'Maha (Oct–Apr next year)', waterNeed: 'Moderate', profitability: 'Very High',
    rationale: {
      en: 'Long-duration (8–10 months) high-value spice crop. Wet zone loam soils with good shade and drainage produce premium grade ginger. Strong export and processing demand.',
      si: 'දිගු කාලීන (මාස 8-10) ඉහළ-අගය කුළු බඩු බෝගය. සෙවනැලි සහිත ශ්‍රේෂ්ඨ ජලාපවහනය ඇති ලෝම් පසෙහි ශ්‍රේෂ්ඨ ඉඟුරු ලැබේ.',
      ta: 'நீண்ட கால (8-10 மாதம்) அதிக மதிப்புள்ள மசாலா பயிர். நிழல் மற்றும் நல்ல வடிகால் கொண்ட மண்ணில் தரமான இஞ்சி கிடைக்கும்.',
    },
  },
  Okra: {
    en: 'Okra / Ladies Fingers', si: 'බැండක්කා', ta: 'வெண்டைக்காய்',
    season: 'Both Maha & Yala', waterNeed: 'Low-Moderate', profitability: 'Moderate',
    rationale: {
      en: 'Fast-growing heat-tolerant crop ideal for lowland warm regions. Quick return (45–55 days to first harvest). Year-round consistent demand at all collection centres.',
      si: 'නිවර්තන ප්‍රදේශ සඳහා ශ්‍රේෂ්ඨ ඉක්මනින් වර්ධනය වන ගෙඩි. මුල් අස්වැන්නට දින 45-55 ක් පමණ. සෑම මධ්‍යස්ථානයකම ස්ථාවර ඉල්ලුම.',
      ta: 'வெப்பத்தை தாங்கும் விரைவாக வளரும் பயிர். முதல் மகசூலுக்கு 45-55 நாட்கள். அனைத்து மையங்களிலும் நிலையான தேவை.',
    },
  },
  Sugarcane: {
    en: 'Sugarcane', si: 'උක්', ta: 'கரும்பு',
    season: 'All-year (18 months)', waterNeed: 'High', profitability: 'Moderate',
    rationale: {
      en: 'Perennial crop with guaranteed purchase by sugar factories. Best suited for Ampara, Sevanagala areas with alluvial clay soils and reliable irrigation.',
      si: 'සීනි කර්මාන්ත ශාලා විසින් ක්ෂේතර මිලට ගනු ලබන දීර්ඝකාලීන බෝගය. අම්පාර, සේවනාගල ප්‍රදේශවල ගංගා ලිප පසෙහි ශ්‍රේෂ්ඨ.',
      ta: 'சர்க்கரை ஆலைகளால் கொள்முதல் உத்தரவாதம். அம்பாறை, செவனாகல பகுதிகளில் மிகவும் பொருத்தமானது.',
    },
  },
};

// ─── District-Specific Agro-Climatic Profiles (All 25 Districts) ────────────
const DISTRICT_PROFILES: Record<string, DistrictProfile> = {

  // ═══════════════════════════════════════════════════════════════════
  // HIGH COUNTRY COOL ZONE (>1200m, 1500–2500mm rainfall)
  // ═══════════════════════════════════════════════════════════════════
  'Nuwara Eliya': {
    zone: 'High Country Upcountry – Cool Highlands',
    rainfall: '2500mm+', altitude: '1800–2500m',
    soilTypes: ['Volcanic red loam', 'Sandy loam', 'Acidic mountain soils (pH 4.5–5.5)'],
    seasons: ['Maha (Oct–Feb) – Primary', 'Yala (Mar–Sep) – Secondary'],
    climate: 'Sub-temperate, heavy mist, 5–20°C average',
    primaryCrops: ['Potato', 'Carrot', 'Cabbage', 'Leeks', 'Beetroot', 'Beans'],
    avoidAfter: {
      Potato: ['Tomato', 'Brinjal', 'Chilli'],  // same Solanaceae family
      Cabbage: ['Cauliflower', 'Broccoli', 'Cabbage'],
    },
    topRecommendations: {
      Rice: ['Potato', 'Carrot', 'Cabbage'],
      Potato: ['Carrot', 'Beans', 'Cabbage'],
      Carrot: ['Potato', 'Beans', 'Cabbage'],
      Cabbage: ['Potato', 'Beans', 'Carrot'],
      Beans: ['Potato', 'Carrot', 'Cabbage'],
      None: ['Potato', 'Carrot', 'Cabbage'],
    },
    defaultRecommendations: ['Potato', 'Carrot', 'Cabbage'],
  },

  'Badulla': {
    zone: 'Mid-to-High Country – Highland Transition',
    rainfall: '1500–2000mm', altitude: '600–2000m (varies by elevation)',
    soilTypes: ['Red-yellow latosols', 'Sandy loam', 'Red loam', 'pH 5.0–6.0'],
    seasons: ['Maha (Oct–Feb) – Best', 'Yala (Apr–Aug) – Lower valleys'],
    climate: 'Cool-to-mild, 15–25°C, moderate rainfall',
    primaryCrops: ['Carrot', 'Cabbage', 'Beans', 'Potato', 'Tomato', 'Bittergourd'],
    avoidAfter: {
      Tomato: ['Brinjal', 'Potato', 'Chilli'],
      Potato: ['Tomato', 'Brinjal'],
    },
    topRecommendations: {
      Rice: ['Carrot', 'Cabbage', 'Beans'],
      Tomato: ['Beans', 'Carrot', 'Cabbage'],
      Potato: ['Carrot', 'Beans', 'Cabbage'],
      Carrot: ['Beans', 'Tomato', 'Cabbage'],
      Cabbage: ['Beans', 'Carrot', 'Tomato'],
      Beans: ['Tomato', 'Carrot', 'Bittergourd'],
      None: ['Carrot', 'Beans', 'Tomato'],
    },
    defaultRecommendations: ['Carrot', 'Beans', 'Tomato'],
  },

  // ═══════════════════════════════════════════════════════════════════
  // MID COUNTRY ZONE (300–1200m, 1500–2500mm rainfall)
  // ═══════════════════════════════════════════════════════════════════
  'Kandy': {
    zone: 'Mid Country Wet Zone – Hill Country',
    rainfall: '2000–2500mm', altitude: '450–1200m',
    soilTypes: ['Red-yellow latosols', 'Loam', 'Clay loam (pH 5.5–6.5)'],
    seasons: ['Maha (Oct–Mar) – Primary', 'Yala (Apr–Sep) – Possible'],
    climate: 'Warm-humid, 20–28°C, heavy rainfall',
    primaryCrops: ['Tomato', 'Beans', 'Chilli', 'Capsicum', 'Bittergourd', 'Brinjal', 'Ginger'],
    avoidAfter: {
      Tomato: ['Brinjal', 'Chilli', 'Potato'],
      Chilli: ['Tomato', 'Brinjal'],
    },
    topRecommendations: {
      Rice: ['Tomato', 'Beans', 'Chilli'],
      Tomato: ['Beans', 'Capsicum', 'Bittergourd'],
      Chilli: ['Beans', 'Tomato', 'Brinjal'],
      Brinjal: ['Beans', 'Tomato', 'Bittergourd'],
      Beans: ['Tomato', 'Chilli', 'Capsicum'],
      None: ['Tomato', 'Beans', 'Chilli'],
    },
    defaultRecommendations: ['Tomato', 'Beans', 'Chilli'],
  },

  'Matale': {
    zone: 'Mid Country Intermediate Zone',
    rainfall: '1200–1800mm', altitude: '200–800m',
    soilTypes: ['Reddish brown earths', 'Sandy loam', 'pH 6.0–7.0'],
    seasons: ['Maha (Oct–Feb) – Primary', 'Yala (Apr–Jul)'],
    climate: 'Warm dry-to-moderate, 25–32°C',
    primaryCrops: ['Onion', 'Tomato', 'Chilli', 'Bittergourd', 'Beans', 'Maize'],
    avoidAfter: {
      Onion: ['Garlic', 'Leek'],
      Tomato: ['Brinjal', 'Chilli'],
    },
    topRecommendations: {
      Rice: ['Onion', 'Tomato', 'Chilli'],
      Tomato: ['Beans', 'Onion', 'Bittergourd'],
      Onion: ['Tomato', 'Chilli', 'Maize'],
      Maize: ['Beans', 'Cowpea', 'Chilli'],
      Chilli: ['Beans', 'Maize', 'Onion'],
      Beans: ['Tomato', 'Onion', 'Chilli'],
      None: ['Onion', 'Tomato', 'Chilli'],
    },
    defaultRecommendations: ['Onion', 'Tomato', 'Chilli'],
  },

  'Dambulla': {
    zone: 'Mid Country Dry Zone – Irrigated Plains',
    rainfall: '900–1400mm', altitude: '100–400m',
    soilTypes: ['Reddish brown earths', 'Sandy loam', 'pH 6.5–7.5'],
    seasons: ['Maha (Oct–Feb)', 'Yala (Apr–Aug) with irrigation'],
    climate: 'Warm-dry, 28–35°C, strong dry seasons',
    primaryCrops: ['Onion', 'Chilli', 'Tomato', 'Watermelon', 'Maize', 'Pumpkin'],
    avoidAfter: {
      Onion: ['Garlic'],
      Tomato: ['Brinjal', 'Chilli'],
    },
    topRecommendations: {
      Rice: ['Onion', 'Chilli', 'Tomato'],
      Onion: ['Chilli', 'Tomato', 'Watermelon'],
      Tomato: ['Onion', 'Maize', 'Watermelon'],
      Maize: ['Cowpea', 'Beans', 'Chilli'],
      Chilli: ['Onion', 'Watermelon', 'Maize'],
      Watermelon: ['Beans', 'Cowpea', 'Chilli'],
      None: ['Onion', 'Chilli', 'Watermelon'],
    },
    defaultRecommendations: ['Onion', 'Chilli', 'Watermelon'],
  },

  'Kegalle': {
    zone: 'Wet Zone Mid Country – Rubber Belt',
    rainfall: '2500–3500mm', altitude: '50–500m',
    soilTypes: ['Red-yellow latosols', 'Clay loam', 'pH 4.5–5.5'],
    seasons: ['Maha (Oct–Mar) – Primary', 'Yala (Apr–Sep)'],
    climate: 'Hot-humid, 25–30°C, very heavy rainfall',
    primaryCrops: ['Tomato', 'Beans', 'Brinjal', 'Bittergourd', 'Okra', 'Ginger'],
    avoidAfter: {
      Tomato: ['Brinjal', 'Chilli'],
    },
    topRecommendations: {
      Rice: ['Tomato', 'Beans', 'Brinjal'],
      Tomato: ['Beans', 'Bittergourd', 'Okra'],
      Brinjal: ['Beans', 'Okra', 'Ginger'],
      Beans: ['Tomato', 'Brinjal', 'Bittergourd'],
      None: ['Tomato', 'Beans', 'Brinjal'],
    },
    defaultRecommendations: ['Tomato', 'Beans', 'Brinjal'],
  },

  'Ratnapura': {
    zone: 'Wet Zone Low Country – Sabaragamuwa',
    rainfall: '3500–5000mm', altitude: '30–300m',
    soilTypes: ['Red-yellow latosols', 'Acidic clay (pH 4.5–5.5)', 'Alluvial valleys'],
    seasons: ['Maha (Oct–Apr) – Primary', 'Yala (Apr–Sep)'],
    climate: 'Tropical humid, 25–30°C, heaviest rainfall in SL',
    primaryCrops: ['Beans', 'Brinjal', 'Okra', 'Bittergourd', 'Ginger', 'Tomato'],
    avoidAfter: {
      Tomato: ['Brinjal', 'Chilli'],
    },
    topRecommendations: {
      Rice: ['Beans', 'Brinjal', 'Okra'],
      Tomato: ['Beans', 'Ginger', 'Bittergourd'],
      Beans: ['Tomato', 'Brinjal', 'Bittergourd'],
      Brinjal: ['Beans', 'Okra', 'Ginger'],
      None: ['Beans', 'Brinjal', 'Okra'],
    },
    defaultRecommendations: ['Beans', 'Brinjal', 'Okra'],
  },

  // ═══════════════════════════════════════════════════════════════════
  // NORTH CENTRAL DRY ZONE (Paddy Belt, 900–1500mm rainfall)
  // ═══════════════════════════════════════════════════════════════════
  'Anuradhapura': {
    zone: 'North Central Dry Zone – Ancient Paddy Heartland',
    rainfall: '900–1500mm', altitude: '50–150m',
    soilTypes: ['Reddish brown earths', 'Low humic gley', 'Sandy loam (pH 6.0–7.5)'],
    seasons: ['Maha (Oct–Feb) – Paddy season', 'Yala (May–Aug) – OFC season'],
    climate: 'Semi-arid, 27–35°C, strong dry spell Apr–Sep',
    primaryCrops: ['Rice', 'Maize', 'Cowpea', 'Chilli', 'Onion', 'Pumpkin', 'Sesame'],
    avoidAfter: {
      Rice: ['Rice'],  // avoid continuous paddy monoculture
      Maize: ['Maize'],
    },
    topRecommendations: {
      Rice: ['Maize', 'Cowpea', 'Chilli'],
      Maize: ['Cowpea', 'Beans', 'Chilli'],
      Chilli: ['Onion', 'Maize', 'Cowpea'],
      Onion: ['Chilli', 'Pumpkin', 'Cowpea'],
      Cowpea: ['Maize', 'Chilli', 'Onion'],
      Pumpkin: ['Cowpea', 'Maize', 'Chilli'],
      None: ['Rice', 'Maize', 'Chilli'],
    },
    defaultRecommendations: ['Rice', 'Maize', 'Chilli'],
  },

  'Polonnaruwa': {
    zone: 'North Central Dry Zone – Mahaweli Irrigated',
    rainfall: '1000–1500mm', altitude: '60–120m',
    soilTypes: ['Reddish brown earths', 'Alluvial flats', 'pH 6.5–7.5'],
    seasons: ['Maha (Oct–Feb)', 'Yala (Apr–Aug) with Mahaweli irrigation'],
    climate: 'Semi-arid, 28–35°C, reliable Mahaweli water supply',
    primaryCrops: ['Rice', 'Maize', 'Chilli', 'Onion', 'Cowpea', 'Watermelon'],
    avoidAfter: {
      Rice: ['Rice'],
      Maize: ['Sorghum', 'Maize'],
    },
    topRecommendations: {
      Rice: ['Maize', 'Cowpea', 'Watermelon'],
      Maize: ['Cowpea', 'Chilli', 'Onion'],
      Onion: ['Chilli', 'Watermelon', 'Cowpea'],
      Chilli: ['Maize', 'Onion', 'Cowpea'],
      Cowpea: ['Chilli', 'Onion', 'Watermelon'],
      None: ['Rice', 'Maize', 'Onion'],
    },
    defaultRecommendations: ['Rice', 'Maize', 'Onion'],
  },

  // ═══════════════════════════════════════════════════════════════════
  // NORTHERN DRY PENINSULA (Arid, 800–1200mm rainfall)
  // ═══════════════════════════════════════════════════════════════════
  'Jaffna': {
    zone: 'Northern Arid Peninsula – Coral Limestone Soils',
    rainfall: '800–1200mm', altitude: '0–30m',
    soilTypes: ['Reddish brown latosols', 'Sandy loam on coral limestone', 'pH 7.0–8.0'],
    seasons: ['Maha (Oct–Jan) – Main', 'Yala (May–Aug) with wells/irrigation'],
    climate: 'Arid-tropical, 25–35°C, two distinct dry seasons',
    primaryCrops: ['Onion', 'Chilli', 'Brinjal', 'Cowpea', 'Okra', 'Watermelon'],
    avoidAfter: {
      Onion: ['Garlic'],
      Chilli: ['Tomato', 'Brinjal'],
    },
    topRecommendations: {
      Rice: ['Onion', 'Chilli', 'Cowpea'],
      Onion: ['Chilli', 'Brinjal', 'Cowpea'],
      Chilli: ['Onion', 'Cowpea', 'Okra'],
      Brinjal: ['Onion', 'Cowpea', 'Okra'],
      Cowpea: ['Onion', 'Chilli', 'Watermelon'],
      None: ['Onion', 'Chilli', 'Cowpea'],
    },
    defaultRecommendations: ['Onion', 'Chilli', 'Cowpea'],
  },

  'Kilinochchi': {
    zone: 'Northern Dry Zone – Lagoon Borders',
    rainfall: '900–1200mm', altitude: '0–50m',
    soilTypes: ['Reddish brown earths', 'Sandy soils', 'pH 6.5–7.5'],
    seasons: ['Maha (Oct–Feb) – Main'],
    climate: 'Semi-arid, 27–34°C',
    primaryCrops: ['Onion', 'Chilli', 'Cowpea', 'Pumpkin', 'Okra'],
    avoidAfter: { Onion: ['Garlic'] },
    topRecommendations: {
      Rice: ['Onion', 'Chilli', 'Cowpea'],
      Onion: ['Chilli', 'Cowpea', 'Pumpkin'],
      Chilli: ['Onion', 'Cowpea', 'Okra'],
      Cowpea: ['Onion', 'Chilli', 'Pumpkin'],
      None: ['Onion', 'Chilli', 'Cowpea'],
    },
    defaultRecommendations: ['Onion', 'Chilli', 'Cowpea'],
  },

  'Mannar': {
    zone: 'Northern Arid Zone – Coastal Dry',
    rainfall: '800–1000mm', altitude: '0–30m',
    soilTypes: ['Sandy soils', 'Saline coastal soils', 'pH 6.5–7.5'],
    seasons: ['Maha (Oct–Jan) – Main', 'Irrigated Yala possible'],
    climate: 'Very arid, 28–36°C, strong north-east winds',
    primaryCrops: ['Onion', 'Chilli', 'Cowpea', 'Watermelon', 'Pumpkin'],
    avoidAfter: {},
    topRecommendations: {
      Rice: ['Onion', 'Cowpea', 'Chilli'],
      Onion: ['Cowpea', 'Chilli', 'Watermelon'],
      Chilli: ['Onion', 'Cowpea', 'Pumpkin'],
      Cowpea: ['Onion', 'Watermelon', 'Chilli'],
      None: ['Onion', 'Cowpea', 'Chilli'],
    },
    defaultRecommendations: ['Onion', 'Cowpea', 'Watermelon'],
  },

  'Vavuniya': {
    zone: 'North Central Dry Zone – Transition',
    rainfall: '1000–1400mm', altitude: '80–200m',
    soilTypes: ['Reddish brown earths', 'Sandy loam', 'pH 6.5–7.5'],
    seasons: ['Maha (Oct–Feb) – Main', 'Limited Yala'],
    climate: 'Semi-arid, 27–34°C',
    primaryCrops: ['Onion', 'Chilli', 'Cowpea', 'Maize', 'Pumpkin'],
    avoidAfter: {},
    topRecommendations: {
      Rice: ['Chilli', 'Cowpea', 'Maize'],
      Onion: ['Chilli', 'Pumpkin', 'Cowpea'],
      Chilli: ['Onion', 'Cowpea', 'Maize'],
      Cowpea: ['Chilli', 'Onion', 'Pumpkin'],
      Maize: ['Cowpea', 'Chilli', 'Pumpkin'],
      None: ['Onion', 'Chilli', 'Cowpea'],
    },
    defaultRecommendations: ['Onion', 'Chilli', 'Cowpea'],
  },

  'Mullaitivu': {
    zone: 'Northern Coastal Dry Zone',
    rainfall: '1100–1400mm', altitude: '0–50m',
    soilTypes: ['Sandy coastal soils', 'Reddish brown earths', 'pH 6.0–7.0'],
    seasons: ['Maha (Oct–Feb) – Main'],
    climate: 'Semi-arid coastal, 25–33°C',
    primaryCrops: ['Cowpea', 'Chilli', 'Onion', 'Pumpkin', 'Okra'],
    avoidAfter: {},
    topRecommendations: {
      Rice: ['Cowpea', 'Chilli', 'Pumpkin'],
      Onion: ['Cowpea', 'Chilli', 'Okra'],
      Chilli: ['Cowpea', 'Onion', 'Pumpkin'],
      Cowpea: ['Chilli', 'Onion', 'Okra'],
      None: ['Cowpea', 'Chilli', 'Onion'],
    },
    defaultRecommendations: ['Cowpea', 'Chilli', 'Onion'],
  },

  // ═══════════════════════════════════════════════════════════════════
  // EASTERN DRY ZONE (900–1500mm rainfall)
  // ═══════════════════════════════════════════════════════════════════
  'Batticaloa': {
    zone: 'Eastern Dry Zone – Coastal Lagoon',
    rainfall: '1500–2000mm', altitude: '0–50m',
    soilTypes: ['Reddish brown earths', 'Alluvial coastal', 'pH 6.0–7.0'],
    seasons: ['Maha (Oct–Feb) – Main Paddy', 'Yala (May–Sep) – OFC/Vegetables'],
    climate: 'Tropical dry, 26–34°C, north-east monsoon rains',
    primaryCrops: ['Rice', 'Maize', 'Chilli', 'Cowpea', 'Pumpkin', 'Watermelon'],
    avoidAfter: { Rice: ['Rice'] },
    topRecommendations: {
      Rice: ['Cowpea', 'Maize', 'Chilli'],
      Maize: ['Cowpea', 'Chilli', 'Pumpkin'],
      Chilli: ['Cowpea', 'Maize', 'Watermelon'],
      Cowpea: ['Maize', 'Chilli', 'Pumpkin'],
      None: ['Rice', 'Maize', 'Chilli'],
    },
    defaultRecommendations: ['Rice', 'Maize', 'Chilli'],
  },

  'Ampara': {
    zone: 'Eastern Dry Zone – Gal Oya Irrigation',
    rainfall: '1300–1800mm', altitude: '0–100m',
    soilTypes: ['Reddish brown earths', 'Alluvial flats', 'pH 6.5–7.5'],
    seasons: ['Maha (Oct–Feb)', 'Yala (Apr–Aug) with Gal Oya irrigation'],
    climate: 'Semi-arid, 26–34°C',
    primaryCrops: ['Rice', 'Sugarcane', 'Maize', 'Cowpea', 'Chilli', 'Pumpkin'],
    avoidAfter: { Rice: ['Rice'] },
    topRecommendations: {
      Rice: ['Cowpea', 'Maize', 'Chilli'],
      Maize: ['Cowpea', 'Chilli', 'Pumpkin'],
      Sugarcane: ['Cowpea', 'Maize', 'Chilli'],
      Cowpea: ['Maize', 'Chilli', 'Watermelon'],
      None: ['Rice', 'Maize', 'Cowpea'],
    },
    defaultRecommendations: ['Rice', 'Maize', 'Cowpea'],
  },

  'Trincomalee': {
    zone: 'Eastern Dry Zone – Mahaweli Coastal',
    rainfall: '1400–1800mm', altitude: '0–100m',
    soilTypes: ['Sandy loam', 'Reddish brown earths', 'pH 6.0–7.0'],
    seasons: ['Maha (Oct–Feb) – Primary', 'Yala (May–Sep) – Irrigated'],
    climate: 'Semi-arid coastal, 26–33°C',
    primaryCrops: ['Rice', 'Maize', 'Cowpea', 'Chilli', 'Watermelon', 'Pumpkin'],
    avoidAfter: { Rice: ['Rice'] },
    topRecommendations: {
      Rice: ['Cowpea', 'Chilli', 'Watermelon'],
      Maize: ['Cowpea', 'Beans', 'Chilli'],
      Chilli: ['Cowpea', 'Maize', 'Watermelon'],
      Cowpea: ['Chilli', 'Maize', 'Pumpkin'],
      None: ['Rice', 'Maize', 'Cowpea'],
    },
    defaultRecommendations: ['Rice', 'Maize', 'Cowpea'],
  },

  // ═══════════════════════════════════════════════════════════════════
  // NORTH WESTERN INTERMEDIATE ZONE
  // ═══════════════════════════════════════════════════════════════════
  'Kurunegala': {
    zone: 'North Western Intermediate Zone',
    rainfall: '1200–1800mm', altitude: '50–300m',
    soilTypes: ['Reddish brown earths', 'Sandy loam', 'pH 6.0–7.0'],
    seasons: ['Maha (Oct–Mar) – Primary', 'Yala (Apr–Sep)'],
    climate: 'Moderate tropical, 27–33°C',
    primaryCrops: ['Chilli', 'Tomato', 'Brinjal', 'Beans', 'Pumpkin', 'Maize'],
    avoidAfter: {
      Tomato: ['Brinjal', 'Chilli'],
      Chilli: ['Tomato', 'Brinjal'],
    },
    topRecommendations: {
      Rice: ['Chilli', 'Tomato', 'Beans'],
      Tomato: ['Beans', 'Brinjal', 'Pumpkin'],
      Chilli: ['Beans', 'Tomato', 'Pumpkin'],
      Brinjal: ['Beans', 'Chilli', 'Pumpkin'],
      Maize: ['Beans', 'Cowpea', 'Chilli'],
      Beans: ['Chilli', 'Tomato', 'Brinjal'],
      None: ['Chilli', 'Tomato', 'Beans'],
    },
    defaultRecommendations: ['Chilli', 'Tomato', 'Beans'],
  },

  'Puttalam': {
    zone: 'North Western Dry Zone – Coastal',
    rainfall: '800–1300mm', altitude: '0–50m',
    soilTypes: ['Sandy soils', 'Reddish brown earths', 'pH 6.5–7.5'],
    seasons: ['Maha (Oct–Jan) – Main', 'Limited Yala'],
    climate: 'Dry coastal, 27–35°C, strong dry season',
    primaryCrops: ['Onion', 'Chilli', 'Watermelon', 'Cowpea', 'Maize'],
    avoidAfter: {},
    topRecommendations: {
      Rice: ['Onion', 'Chilli', 'Cowpea'],
      Onion: ['Chilli', 'Watermelon', 'Cowpea'],
      Chilli: ['Onion', 'Cowpea', 'Maize'],
      Cowpea: ['Onion', 'Watermelon', 'Chilli'],
      None: ['Onion', 'Chilli', 'Watermelon'],
    },
    defaultRecommendations: ['Onion', 'Chilli', 'Watermelon'],
  },

  // ═══════════════════════════════════════════════════════════════════
  // WESTERN WET ZONE (2000–3500mm rainfall)
  // ═══════════════════════════════════════════════════════════════════
  'Colombo': {
    zone: 'Western Wet Zone – Urban & Peri-Urban',
    rainfall: '2400–3500mm', altitude: '0–30m',
    soilTypes: ['Low humic gley', 'Alluvial', 'Red-yellow latosol', 'pH 5.5–6.5'],
    seasons: ['Year-round with good drainage', 'Maha (Oct–Apr) best'],
    climate: 'Tropical humid, 26–31°C, two monsoons',
    primaryCrops: ['Tomato', 'Beans', 'Brinjal', 'Okra', 'Bittergourd', 'Leafy Vegetables'],
    avoidAfter: {
      Tomato: ['Brinjal', 'Chilli'],
    },
    topRecommendations: {
      Rice: ['Brinjal', 'Tomato', 'Beans'],
      Tomato: ['Beans', 'Okra', 'Bittergourd'],
      Brinjal: ['Beans', 'Okra', 'Tomato'],
      Beans: ['Tomato', 'Brinjal', 'Bittergourd'],
      None: ['Tomato', 'Brinjal', 'Beans'],
    },
    defaultRecommendations: ['Tomato', 'Brinjal', 'Beans'],
  },

  'Gampaha': {
    zone: 'Western Wet Zone – Coconut Triangle',
    rainfall: '2500–3000mm', altitude: '5–50m',
    soilTypes: ['Red-yellow latosols', 'Alluvial flats', 'pH 5.0–6.0'],
    seasons: ['Maha (Oct–Mar) – Best', 'Yala possible'],
    climate: 'Hot-humid, 26–32°C',
    primaryCrops: ['Tomato', 'Brinjal', 'Beans', 'Okra', 'Bittergourd', 'Ginger'],
    avoidAfter: {
      Tomato: ['Brinjal', 'Chilli'],
    },
    topRecommendations: {
      Rice: ['Brinjal', 'Beans', 'Okra'],
      Tomato: ['Beans', 'Bittergourd', 'Okra'],
      Brinjal: ['Beans', 'Okra', 'Ginger'],
      Beans: ['Tomato', 'Brinjal', 'Bittergourd'],
      None: ['Tomato', 'Brinjal', 'Beans'],
    },
    defaultRecommendations: ['Tomato', 'Brinjal', 'Beans'],
  },

  'Kalutara': {
    zone: 'Western Wet Zone – Coastal South',
    rainfall: '2500–4000mm', altitude: '0–100m',
    soilTypes: ['Red-yellow latosols', 'Alluvial', 'Acidic clay (pH 4.5–5.5)'],
    seasons: ['Maha (Oct–Apr) – Primary', 'Yala possible'],
    climate: 'Hot-humid coastal, 26–31°C',
    primaryCrops: ['Beans', 'Brinjal', 'Okra', 'Bittergourd', 'Tomato', 'Ginger'],
    avoidAfter: {
      Tomato: ['Brinjal', 'Chilli'],
    },
    topRecommendations: {
      Rice: ['Beans', 'Brinjal', 'Okra'],
      Tomato: ['Beans', 'Ginger', 'Bittergourd'],
      Brinjal: ['Beans', 'Okra', 'Bittergourd'],
      Beans: ['Tomato', 'Brinjal', 'Okra'],
      None: ['Beans', 'Brinjal', 'Okra'],
    },
    defaultRecommendations: ['Beans', 'Brinjal', 'Okra'],
  },

  // ═══════════════════════════════════════════════════════════════════
  // SOUTHERN WET/INTERMEDIATE ZONE
  // ═══════════════════════════════════════════════════════════════════
  'Galle': {
    zone: 'Southern Wet Zone – Coastal',
    rainfall: '2000–3000mm', altitude: '0–200m',
    soilTypes: ['Red-yellow latosols', 'Sandy loam coastal', 'pH 5.0–6.0'],
    seasons: ['Maha (Oct–Mar) – Primary', 'Yala (Apr–Sep) less reliable'],
    climate: 'Tropical coastal, 26–31°C, south-west monsoon',
    primaryCrops: ['Tomato', 'Brinjal', 'Beans', 'Bittergourd', 'Okra', 'Ginger'],
    avoidAfter: {
      Tomato: ['Brinjal', 'Chilli'],
    },
    topRecommendations: {
      Rice: ['Tomato', 'Brinjal', 'Beans'],
      Tomato: ['Beans', 'Brinjal', 'Bittergourd'],
      Brinjal: ['Beans', 'Okra', 'Tomato'],
      Beans: ['Tomato', 'Brinjal', 'Bittergourd'],
      None: ['Tomato', 'Brinjal', 'Beans'],
    },
    defaultRecommendations: ['Tomato', 'Brinjal', 'Beans'],
  },

  'Matara': {
    zone: 'Southern Wet Zone – Transitional',
    rainfall: '2000–2500mm', altitude: '0–100m',
    soilTypes: ['Red-yellow latosols', 'Sandy loam', 'pH 5.5–6.5'],
    seasons: ['Maha (Oct–Mar) – Primary'],
    climate: 'Tropical, 25–30°C',
    primaryCrops: ['Tomato', 'Brinjal', 'Beans', 'Okra', 'Bittergourd'],
    avoidAfter: { Tomato: ['Brinjal', 'Chilli'] },
    topRecommendations: {
      Rice: ['Tomato', 'Brinjal', 'Beans'],
      Tomato: ['Beans', 'Bittergourd', 'Okra'],
      Brinjal: ['Beans', 'Tomato', 'Okra'],
      Beans: ['Tomato', 'Brinjal', 'Bittergourd'],
      None: ['Tomato', 'Brinjal', 'Beans'],
    },
    defaultRecommendations: ['Tomato', 'Brinjal', 'Beans'],
  },

  'Hambantota': {
    zone: 'Southern Dry Zone – Arid Southern Coast',
    rainfall: '800–1200mm', altitude: '0–100m',
    soilTypes: ['Reddish brown earths', 'Sandy loam', 'pH 6.5–7.5'],
    seasons: ['Maha (Oct–Feb) – Main', 'Yala (May–Sep) – Irrigated'],
    climate: 'Semi-arid southern, 27–34°C, very dry Apr–Sep',
    primaryCrops: ['Maize', 'Pumpkin', 'Watermelon', 'Cowpea', 'Chilli', 'Onion'],
    avoidAfter: { Maize: ['Sorghum'] },
    topRecommendations: {
      Rice: ['Maize', 'Cowpea', 'Pumpkin'],
      Maize: ['Cowpea', 'Pumpkin', 'Chilli'],
      Pumpkin: ['Cowpea', 'Maize', 'Watermelon'],
      Cowpea: ['Maize', 'Chilli', 'Watermelon'],
      Chilli: ['Cowpea', 'Pumpkin', 'Onion'],
      None: ['Maize', 'Pumpkin', 'Watermelon'],
    },
    defaultRecommendations: ['Maize', 'Pumpkin', 'Watermelon'],
  },

  'Moneragala': {
    zone: 'Dry Zone – Uva Transition',
    rainfall: '1000–1500mm', altitude: '100–500m',
    soilTypes: ['Reddish brown earths', 'Sandy loam', 'pH 6.5–7.5'],
    seasons: ['Maha (Oct–Feb) – Main', 'Limited Yala'],
    climate: 'Semi-arid, 26–33°C',
    primaryCrops: ['Maize', 'Chilli', 'Cowpea', 'Pumpkin', 'Sesame'],
    avoidAfter: {},
    topRecommendations: {
      Rice: ['Maize', 'Cowpea', 'Chilli'],
      Maize: ['Cowpea', 'Chilli', 'Pumpkin'],
      Chilli: ['Maize', 'Cowpea', 'Pumpkin'],
      Cowpea: ['Maize', 'Chilli', 'Pumpkin'],
      None: ['Chilli', 'Maize', 'Cowpea'],
    },
    defaultRecommendations: ['Chilli', 'Maize', 'Cowpea'],
  },
};

// ─── Normalise District Name Input ───────────────────────────────────────────
function resolveDistrict(input: string): string | null {
  const lower = input.toLowerCase().trim();
  const known = Object.keys(DISTRICT_PROFILES);
  // Exact match first
  const exact = known.find(k => k.toLowerCase() === lower);
  if (exact) return exact;
  // Partial match
  const partial = known.find(k => lower.includes(k.toLowerCase()) || k.toLowerCase().includes(lower));
  return partial || null;
}

// ─── Normalise Previous Crop Input ───────────────────────────────────────────
function resolvePreviousCrop(input: string): string {
  const lower = (input || '').toLowerCase().trim();
  if (!lower || lower === 'none' || lower === 'nothing' || lower === 'first' || lower === 'new') return 'None';
  if (lower.includes('rice') || lower.includes('paddy') || lower.includes('goyan') || lower.includes('நெல்')) return 'Rice';
  if (lower.includes('tomato') || lower.includes('takkali') || lower.includes('தக்காளி')) return 'Tomato';
  if (lower.includes('carrot') || lower.includes('kaerat') || lower.includes('கரட்')) return 'Carrot';
  if (lower.includes('cabbage') || lower.includes('gova') || lower.includes('முட்டை')) return 'Cabbage';
  if (lower.includes('bean') || lower.includes('bonchi') || lower.includes('பீன்')) return 'Beans';
  if (lower.includes('potato') || lower.includes('arthapal') || lower.includes('உருளை')) return 'Potato';
  if (lower.includes('onion') || lower.includes('lunu') || lower.includes('வெங்காயம்')) return 'Onion';
  if (lower.includes('chilli') || lower.includes('miris') || lower.includes('மிளகாய்')) return 'Chilli';
  if (lower.includes('brinjal') || lower.includes('wambatu') || lower.includes('கத்தரி')) return 'Brinjal';
  if (lower.includes('maize') || lower.includes('corn') || lower.includes('badiringu') || lower.includes('சோளம்')) return 'Maize';
  if (lower.includes('pumpkin') || lower.includes('wattakka') || lower.includes('பூசணி')) return 'Pumpkin';
  if (lower.includes('cowpea') || lower.includes('maa ') || lower.includes('kaawpi') || lower.includes('பயறு')) return 'Cowpea';
  if (lower.includes('watermelon') || lower.includes('komadu') || lower.includes('தர்பூசணி')) return 'Watermelon';
  if (lower.includes('ginger') || lower.includes('inguru') || lower.includes('இஞ்சி')) return 'Ginger';
  if (lower.includes('sugarcane') || lower.includes('uk ') || lower.includes('கரும்பு')) return 'Sugarcane';
  return 'None';
}

// ─── Gemini: wording only ────────────────────────────────────────────────────
// Crop choice and suitability scores come from the deterministic scoring engine
// (services/cropAdvisor.ts). Gemini is only used – when a key is configured – to phrase a short,
// district-specific explanation of crops that were already chosen.
async function getGeminiRationales(
  crops: string[], district: string, previousCrop: string, soilCondition: string, lang: 'en' | 'si' | 'ta',
  districtProfile: DistrictProfile | null
): Promise<string[]> {
  if (!genAI || crops.length === 0) return [];
  const langInstruction = lang === 'si' ? 'Write in Sinhala.' : lang === 'ta' ? 'Write in Tamil.' : 'Write in English.';
  const prompt = `You are a Sri Lankan agricultural officer. A farmer in ${district} district (zone: ${districtProfile?.zone ?? 'unknown'}, rainfall ${districtProfile?.rainfall ?? 'unknown'}) grew "${previousCrop}" last season; soil: ${soilCondition}.
The crops ${crops.join(', ')} have already been selected for next season. For EACH crop, in the same order, write one factual sentence (max 25 words) on why it suits this district and rotation. Do not add other crops.
Respond ONLY as JSON: {"rationales": ["...", "..."]}. ${langInstruction}`;
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    const m = result.response.text().match(/\{[\s\S]*\}/);
    if (!m) return [];
    const parsed = JSON.parse(m[0]);
    return Array.isArray(parsed.rationales) ? parsed.rationales.map((x: unknown) => String(x).slice(0, 300)) : [];
  } catch (err) {
    console.error('[Bot] Gemini wording unavailable, using built-in text:', (err as Error).message);
    return [];
  }
}

// ─── Controller: Get Prompt ───────────────────────────────────────────────────
export const getBotInteractionPrompt = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const lang = ((req.query.lang as string) || 'en').toLowerCase() as 'en' | 'si' | 'ta';
    const step = (req.query.step as string) || 'greeting';
    let promptText = PROMPTS.greeting[lang] || PROMPTS.greeting.en;
    if (step === 'ask_previous_crop') promptText = PROMPTS.askPreviousCrop[lang] || PROMPTS.askPreviousCrop.en;
    sendSuccess(res, { data: { step, language: lang, prompt: promptText } });
  } catch (e) { next(e); }
};

// ─── Controller: Predict Crop Recommendations ─────────────────────────────────
export const predictCropRecommendations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { district, previous_crop, soil_ph, soil_condition, lang = 'en' } = req.body || {};
    const l = String(lang).toLowerCase();
    const userLang = (l === 'si' ? 'si' : l === 'ta' ? 'ta' : 'en') as 'en' | 'si' | 'ta';

    if (!district || typeof district !== 'string') throw new AppError('District is required', 400);
    const resolvedDistrict = resolveDistrict(district);
    if (!resolvedDistrict) throw new AppError(`Unknown district '${district.slice(0, 40)}'. Please choose one of the Sri Lankan districts.`, 400);
    const ph = parseSoilPh(soil_ph);
    if (Number.isNaN(ph)) throw new AppError('Soil pH must be a number between 3 and 10', 400);

    const profile = DISTRICT_PROFILES[resolvedDistrict];
    const prevCrop = resolvePreviousCrop(typeof previous_crop === 'string' ? previous_crop : '');
    const soilDesc = typeof soil_condition === 'string' && soil_condition.trim() ? soil_condition.trim().slice(0, 80) : ph != null ? `pH ${ph}` : 'normal loam';

    const ranked: ScoredCrop[] = rankCrops(profile, prevCrop, ph, 3);
    const aiRationales = await getGeminiRationales(ranked.map(r => r.crop), resolvedDistrict, prevCrop, soilDesc, userLang, profile);
    const aiUsed = aiRationales.length > 0;

    const recommendations = ranked.map((r, index) => {
      const info: any = CROP_INFO[r.crop] || {
        en: r.crop, si: r.crop, ta: r.crop, season: 'Both seasons', waterNeed: 'Moderate', profitability: 'Moderate',
        rationale: { en: `Suited to ${resolvedDistrict} district.`, si: `${resolvedDistrict} දිස්ත්‍රික්කයට සුදුසුයි.`, ta: `${resolvedDistrict} மாவட்டத்திற்கு ஏற்றது.` },
      };
      const builtIn = info.rationale?.[userLang] || info.rationale?.en || '';
      return {
        rank: index + 1,
        crop_code: r.crop,
        name: info[userLang] || info.en,
        name_english: info.en, name_sinhala: info.si, name_tamil: info.ta,
        suitability_score: r.score,
        score_breakdown: r.factors,
        rationale: aiRationales[index] && aiRationales[index].length > 10 ? aiRationales[index] : builtIn,
        season: info.season || 'Check local calendar',
        water_need: info.waterNeed || 'Moderate',
        profitability: info.profitability || 'Moderate',
        ai_powered: aiUsed,
      };
    });

    sendSuccess(res, {
      data: {
        language: userLang,
        district: resolvedDistrict,
        previous_crop: prevCrop,
        soil_ph: ph,
        header: PROMPTS.recommendationHeader[userLang] || PROMPTS.recommendationHeader.en,
        recommendations,
        district_profile: {
          zone: profile.zone, rainfall: profile.rainfall, altitude: profile.altitude, climate: profile.climate,
          best_seasons: profile.seasons, soil_types: profile.soilTypes,
        },
        scoring: 'Scores (0-100) = location 40 + rotation 30 + soil pH 15 + rainfall 15; see score_breakdown per crop.',
        ai_source: aiUsed ? 'gemini' : 'fallback',
        ai_powered: aiUsed,
      },
    });
  } catch (e) { next(e); }
};
