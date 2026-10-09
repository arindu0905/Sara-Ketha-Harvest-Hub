/**
 * Crop advisory scoring (E1-US9..E1-US11).
 *
 * Every recommendation gets a 0-100 suitability score that is *computed* from four transparent
 * factors – never a fixed number by rank:
 *   location   (40)  district agro-ecological fit (expert tables per district, rotation aware)
 *   rotation   (30)  crop-family rotation vs. the previous crop, legume nitrogen benefit
 *   soil pH    (15)  match with the crop's pH range (neutral score if the farmer gave no pH)
 *   rainfall   (15)  district annual rainfall vs. the crop's tolerated range
 * The factor breakdown is returned so the farmer (and tests) can see *why* a crop scored as it did.
 */

export interface CropRequirement {
  family: string;
  phMin: number; phMax: number;
  rainMin: number; rainMax: number;     // mm / year
  fixesNitrogen?: boolean;
}

export const CROP_REQUIREMENTS: Record<string, CropRequirement> = {
  Tomato:      { family: 'solanaceae',   phMin: 5.8, phMax: 7.0, rainMin: 800,  rainMax: 2500 },
  Chilli:      { family: 'solanaceae',   phMin: 5.8, phMax: 7.2, rainMin: 700,  rainMax: 1800 },
  Brinjal:     { family: 'solanaceae',   phMin: 5.8, phMax: 7.0, rainMin: 800,  rainMax: 2500 },
  Capsicum:    { family: 'solanaceae',   phMin: 5.8, phMax: 6.8, rainMin: 800,  rainMax: 2000 },
  Potato:      { family: 'solanaceae',   phMin: 4.8, phMax: 6.2, rainMin: 1200, rainMax: 3500 },
  Carrot:      { family: 'apiaceae',     phMin: 5.5, phMax: 7.0, rainMin: 1000, rainMax: 3500 },
  Cabbage:     { family: 'brassica',     phMin: 6.0, phMax: 7.2, rainMin: 1000, rainMax: 3500 },
  Beans:       { family: 'legume',       phMin: 5.8, phMax: 7.0, rainMin: 900,  rainMax: 3000, fixesNitrogen: true },
  Cowpea:      { family: 'legume',       phMin: 5.5, phMax: 7.5, rainMin: 600,  rainMax: 1800, fixesNitrogen: true },
  Onion:       { family: 'allium',       phMin: 6.0, phMax: 7.5, rainMin: 600,  rainMax: 1500 },
  Rice:        { family: 'cereal',       phMin: 5.0, phMax: 7.5, rainMin: 1000, rainMax: 4000 },
  Maize:       { family: 'cereal',       phMin: 5.5, phMax: 7.5, rainMin: 600,  rainMax: 2000 },
  Pumpkin:     { family: 'cucurbit',     phMin: 5.8, phMax: 7.2, rainMin: 700,  rainMax: 2500 },
  Watermelon:  { family: 'cucurbit',     phMin: 6.0, phMax: 7.2, rainMin: 600,  rainMax: 1500 },
  Bittergourd: { family: 'cucurbit',     phMin: 6.0, phMax: 7.0, rainMin: 800,  rainMax: 2500 },
  Okra:        { family: 'malvaceae',    phMin: 6.0, phMax: 7.5, rainMin: 700,  rainMax: 2500 },
  Ginger:      { family: 'zingiberaceae', phMin: 5.5, phMax: 6.8, rainMin: 1500, rainMax: 3500 },
};

/** Previous crop names accepted from the UI that are not in CROP_REQUIREMENTS (no family known). */
const EXTRA_PREVIOUS_FAMILY: Record<string, string> = { Sugarcane: 'grass' };

export interface AdvisorProfile {
  /** e.g. '1200–1800mm', '2500mm+' */
  rainfall: string;
  primaryCrops: string[];
  topRecommendations: Record<string, string[]>;
  defaultRecommendations: string[];
  avoidAfter: Record<string, string[]>;
}

export interface Factor { name: 'location' | 'rotation' | 'soil_ph' | 'rainfall'; points: number; max: number; note: string }
export interface ScoredCrop { crop: string; score: number; factors: Factor[]; rotation_warning: boolean }

/** Parse the profile's rainfall text into a representative mid-point in mm/year. */
export function rainfallMidpoint(text: string): number | null {
  const nums = (text || '').replace(/,/g, '').match(/\d+(\.\d+)?/g)?.map(Number) ?? [];
  if (nums.length === 0) return null;
  if (nums.length === 1) return /\+/.test(text) ? nums[0] * 1.15 : nums[0];
  return (nums[0] + nums[1]) / 2;
}

/** Linear fall-off: full marks inside [lo,hi], 0 once `tolerance` units outside. */
function rangeScore(value: number, lo: number, hi: number, tolerance: number, max: number): number {
  if (value >= lo && value <= hi) return max;
  const d = value < lo ? lo - value : value - hi;
  return Math.max(0, Math.round(max * (1 - d / tolerance) * 10) / 10);
}

export function familyOf(crop: string): string | null {
  return CROP_REQUIREMENTS[crop]?.family ?? EXTRA_PREVIOUS_FAMILY[crop] ?? null;
}

export function scoreCrop(crop: string, profile: AdvisorProfile, previousCrop: string, soilPh?: number | null): ScoredCrop | null {
  const req = CROP_REQUIREMENTS[crop];
  if (!req) return null;
  const factors: Factor[] = [];

  // 1. Location (40)
  const top = profile.topRecommendations[previousCrop] ?? (previousCrop === 'None' ? profile.defaultRecommendations : []);
  const rank = top.indexOf(crop);
  let loc: number; let locNote: string;
  if (rank >= 0) { loc = [40, 36, 32][rank] ?? 30; locNote = `Expert-recommended for this district after ${previousCrop === 'None' ? 'a fresh start' : previousCrop} (rank ${rank + 1})`; }
  else if (profile.primaryCrops.includes(crop)) { loc = 28; locNote = 'A primary crop of this district'; }
  else { loc = 8; locNote = 'Not a typical crop for this district'; }
  factors.push({ name: 'location', points: loc, max: 40, note: locNote });

  // 2. Rotation (30)
  const prevFamily = previousCrop === 'None' ? null : familyOf(previousCrop);
  let rot: number; let rotNote: string; let warning = false;
  if (previousCrop === crop) { rot = 0; rotNote = 'Same crop as last season – disease and nutrient build-up risk'; warning = true; }
  else if ((profile.avoidAfter[previousCrop] ?? []).includes(crop)) { rot = 0; rotNote = `Should not follow ${previousCrop} in this district`; warning = true; }
  else if (prevFamily && prevFamily === req.family) { rot = 4; rotNote = `Same crop family (${req.family}) as ${previousCrop} – pest and disease carry-over`; warning = true; }
  else if (previousCrop === 'None') { rot = 18; rotNote = 'No rotation history – neutral'; }
  else if (req.fixesNitrogen && !CROP_REQUIREMENTS[previousCrop]?.fixesNitrogen) { rot = 30; rotNote = `Legume restores nitrogen after ${previousCrop}`; }
  else { rot = 24; rotNote = `Different family from ${previousCrop} – good rotation`; }
  factors.push({ name: 'rotation', points: rot, max: 30, note: rotNote });

  // 3. Soil pH (15)
  if (soilPh != null && Number.isFinite(soilPh)) {
    const p = rangeScore(soilPh, req.phMin, req.phMax, 1.5, 15);
    factors.push({ name: 'soil_ph', points: p, max: 15, note: p === 15 ? `pH ${soilPh} is within ${req.phMin}–${req.phMax}` : `pH ${soilPh} is outside the preferred ${req.phMin}–${req.phMax}` });
  } else {
    factors.push({ name: 'soil_ph', points: 9, max: 15, note: 'Soil pH not provided – neutral score' });
  }

  // 4. Rainfall (15)
  const rain = rainfallMidpoint(profile.rainfall);
  if (rain != null) {
    const r = rangeScore(rain, req.rainMin, req.rainMax, 1000, 15);
    factors.push({ name: 'rainfall', points: r, max: 15, note: `~${Math.round(rain)} mm/yr vs. ${req.rainMin}–${req.rainMax} mm tolerated` });
  } else factors.push({ name: 'rainfall', points: 8, max: 15, note: 'District rainfall unknown – neutral' });

  const score = Math.round(factors.reduce((s, f) => s + f.points, 0));
  return { crop, score, factors, rotation_warning: warning };
}

/** Score every known crop for this district/previous crop and return the best `limit`. */
export function rankCrops(profile: AdvisorProfile, previousCrop: string, soilPh?: number | null, limit = 3): ScoredCrop[] {
  return Object.keys(CROP_REQUIREMENTS)
    .map(c => scoreCrop(c, profile, previousCrop, soilPh))
    .filter((s): s is ScoredCrop => !!s && !s.rotation_warning)   // never recommend a rotation violation
    .sort((a, b) => b.score - a.score || a.crop.localeCompare(b.crop))
    .slice(0, limit);
}

export function parseSoilPh(input: unknown): number | null {
  if (input === undefined || input === null || input === '') return null;
  const n = Number(input);
  if (!Number.isFinite(n) || n < 3 || n > 10) return NaN;
  return n;
}
