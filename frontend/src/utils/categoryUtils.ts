export interface CategoryLike {
  id?: string;
  name?: string;
  name_sinhala?: string;
  name_tamil?: string;
  crop_categories?: {
    id?: string;
    name?: string;
    name_sinhala?: string;
    name_tamil?: string;
  };
}

const DEFAULT_SINHALA_NAMES: Record<string, string> = {
  'rice': 'සහල්',
  'vegetables': 'එළවළු',
  'tomato': 'තක්කාලි',
  'carrot': 'කැරට්',
  'cabbage': 'ගෝවා',
  'beans': 'බෝංචි',
  'potato': 'ආලු',
  'onion': 'ලූනු',
  'pumpkin': 'වට්ටක්කා',
  'banana': 'කෙසෙල්',
  'papaya': 'ගස්ලබු',
  'mango': 'අඹ',
  'coconut': 'පොල්',
  'tea': 'තේ',
  'pepper': 'ගම්මිරිස්',
  'fruits': 'පලතුරු',
  'spices': 'කුළුබඩු',
};

const DEFAULT_TAMIL_NAMES: Record<string, string> = {
  'rice': 'அரிசி',
  'vegetables': 'காய்கறிகள்',
  'tomato': 'தக்காளி',
  'carrot': 'கரட்',
  'cabbage': 'முட்டைக்கோஸ்',
  'beans': 'பீன்ஸ்',
  'potato': 'உருளைக்கிழங்கு',
  'onion': 'வெங்காயம்',
  'pumpkin': 'பூசணிக்காய்',
  'banana': 'வாழைப்பழம்',
  'papaya': 'பப்பாளி',
  'mango': 'மாம்பழம்',
  'coconut': 'தேங்காய்',
  'tea': 'தேயிலை',
  'pepper': 'மிளகு',
  'fruits': 'பழங்கள்',
  'spices': 'நறுமணப் பொருட்கள்',
};

export const getCategoryEnglish = (cat?: CategoryLike | null): string => {
  if (!cat) return '';
  const obj = cat.crop_categories || cat;
  return obj.name?.trim() || '';
};

export const getCategorySinhala = (cat?: CategoryLike | null): string => {
  if (!cat) return '';
  const obj = cat.crop_categories || cat;
  if (obj.name_sinhala && obj.name_sinhala.trim()) return obj.name_sinhala.trim();
  const lower = (obj.name || '').toLowerCase().trim();
  return DEFAULT_SINHALA_NAMES[lower] || '';
};

export const getCategoryTamil = (cat?: CategoryLike | null): string => {
  if (!cat) return '';
  const obj = cat.crop_categories || cat;
  if (obj.name_tamil && obj.name_tamil.trim()) return obj.name_tamil.trim();
  const lower = (obj.name || '').toLowerCase().trim();
  return DEFAULT_TAMIL_NAMES[lower] || '';
};

/**
 * Returns category name formatted in all 3 languages (English / Sinhala / Tamil).
 * Example: "Rice / සහල් / அரிசி"
 */
export const formatCategoryName = (cat?: CategoryLike | null): string => {
  if (!cat) return '';
  const en = getCategoryEnglish(cat);
  const si = getCategorySinhala(cat);
  const ta = getCategoryTamil(cat);

  const parts = [en, si, ta].filter(Boolean);
  return parts.join(' / ');
};

/**
 * Returns category name according to the currently active user language ('en' | 'si' | 'ta').
 */
export const formatCategoryForLanguage = (cat?: CategoryLike | null, lang: string = 'en'): string => {
  if (!cat) return '';
  if (lang === 'si') {
    const si = getCategorySinhala(cat);
    if (si) return si;
  } else if (lang === 'ta') {
    const ta = getCategoryTamil(cat);
    if (ta) return ta;
  }
  return getCategoryEnglish(cat);
};
