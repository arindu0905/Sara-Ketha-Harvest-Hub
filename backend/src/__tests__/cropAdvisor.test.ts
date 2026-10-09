import { rankCrops, scoreCrop, rainfallMidpoint, parseSoilPh, AdvisorProfile } from '../services/cropAdvisor';

const upcountry: AdvisorProfile = {
  rainfall: '2500mm+',
  primaryCrops: ['Potato', 'Carrot', 'Cabbage', 'Beans'],
  topRecommendations: { Rice: ['Potato', 'Carrot', 'Cabbage'], Potato: ['Carrot', 'Beans', 'Cabbage'], None: ['Potato', 'Carrot', 'Cabbage'] },
  defaultRecommendations: ['Potato', 'Carrot', 'Cabbage'],
  avoidAfter: { Potato: ['Tomato', 'Brinjal', 'Chilli'] },
};
const dry: AdvisorProfile = {
  rainfall: '800–1200mm',
  primaryCrops: ['Onion', 'Chilli', 'Maize'],
  topRecommendations: { Rice: ['Maize', 'Onion', 'Chilli'] },
  defaultRecommendations: ['Onion', 'Chilli', 'Maize'],
  avoidAfter: {},
};

describe('cropAdvisor – transparent suitability scoring', () => {
  it('parses rainfall ranges and open-ended values', () => {
    expect(rainfallMidpoint('1200–1800mm')).toBe(1500);
    expect(rainfallMidpoint('2500mm+')).toBeGreaterThan(2500);
    expect(rainfallMidpoint('unknown')).toBeNull();
  });

  it('scores are computed from factors, not fixed by rank', () => {
    const a = rankCrops(upcountry, 'Rice', null, 3);
    const b = rankCrops(dry, 'Rice', null, 3);
    expect(a).toHaveLength(3);
    expect(a.map(x => x.score)).not.toEqual([97, 92, 87]);
    expect(a.map(x => x.crop)).not.toEqual(b.map(x => x.crop));
    a.forEach(r => expect(r.factors.reduce((s, f) => s + f.points, 0)).toBe(r.score));
    a.forEach(r => { expect(r.score).toBeGreaterThanOrEqual(0); expect(r.score).toBeLessThanOrEqual(100); });
  });

  it('results are sorted best-first', () => {
    const r = rankCrops(upcountry, 'None', null, 5);
    for (let i = 1; i < r.length; i++) expect(r[i - 1].score).toBeGreaterThanOrEqual(r[i].score);
  });

  it('never recommends a rotation violation (same family / avoidAfter / same crop)', () => {
    const r = rankCrops(upcountry, 'Potato', null, 17).map(x => x.crop);
    expect(r).not.toContain('Potato');
    expect(r).not.toContain('Tomato');   // solanaceae after potato
    expect(r).not.toContain('Brinjal');
    expect(scoreCrop('Tomato', upcountry, 'Potato')!.rotation_warning).toBe(true);
    expect(scoreCrop('Potato', upcountry, 'Potato')!.factors.find(f => f.name === 'rotation')!.points).toBe(0);
  });

  it('rewards a legume after a non-legume crop', () => {
    const beans = scoreCrop('Beans', upcountry, 'Rice')!.factors.find(f => f.name === 'rotation')!;
    const carrot = scoreCrop('Carrot', upcountry, 'Rice')!.factors.find(f => f.name === 'rotation')!;
    expect(beans.points).toBeGreaterThan(carrot.points);
  });

  it('soil pH changes the score and an out-of-range pH is penalised', () => {
    const good = scoreCrop('Cabbage', upcountry, 'Rice', 6.5)!.score;
    const bad = scoreCrop('Cabbage', upcountry, 'Rice', 4.2)!.score;
    const none = scoreCrop('Cabbage', upcountry, 'Rice', null)!.score;
    expect(good).toBeGreaterThan(none);
    expect(none).toBeGreaterThan(bad);
  });

  it('rainfall mismatch lowers the score (onion in very wet district vs dry district)', () => {
    const wet = scoreCrop('Onion', upcountry, 'None')!.factors.find(f => f.name === 'rainfall')!.points;
    const dryPts = scoreCrop('Onion', dry, 'None')!.factors.find(f => f.name === 'rainfall')!.points;
    expect(dryPts).toBeGreaterThan(wet);
  });

  it('returns null for unknown crops', () => {
    expect(scoreCrop('Dragonfruit', dry, 'None')).toBeNull();
  });

  it('parseSoilPh validates input', () => {
    expect(parseSoilPh(undefined)).toBeNull();
    expect(parseSoilPh('')).toBeNull();
    expect(parseSoilPh('6.5')).toBe(6.5);
    expect(parseSoilPh('abc')).toBeNaN();
    expect(parseSoilPh(14)).toBeNaN();
    expect(parseSoilPh(2)).toBeNaN();
  });
});
