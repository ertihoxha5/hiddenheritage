export const MONUMENT_TYPES = ['castle', 'church', 'mosque', 'bridge', 'archaeological', 'monument', 'tower'];
export const TYPE_LABELS = { castle: 'Castle', church: 'Church', mosque: 'Mosque', bridge: 'Bridge', archaeological: 'Archaeological site', monument: 'Monument', tower: 'Tower' };
export const BALKAN_BOUNDS = [[39, 17], [46, 25]];
export const NEIGHBOR_LABELS = [
  { name: 'Albania', position: [41.75, 19.95] },
  { name: 'North Macedonia', position: [41.65, 21.55] },
  { name: 'Serbia', position: [43.35, 21.65] },
  { name: 'Montenegro', position: [42.65, 19.35] },
];
const shapes = {
  castle: '<path d="M4 21V8h4V4h3v4h2V4h3v4h4v13H4Z"/><path d="M9 21v-6a3 3 0 0 1 6 0v6M6 11h2m8 0h2"/>',
  church: '<path d="M3 21V11l5-4 5 4v10H3Zm10 0V8l4-4 4 4v13h-8ZM17 4V1m-2 1h4M7 21v-6h2v6m7-11h2"/>',
  mosque: '<path d="M4 21V12h12v9H4Zm0-9c0-8 12-8 12 0M19 21V7h3v14M19 7l1.5-5L22 7M10 4V2M8 21v-5h4v5"/>',
  bridge: '<path d="M2 20v-9h20v9M2 20h3v-3a3 3 0 0 1 6 0v3h2v-3a3 3 0 0 1 6 0v3h3M2 7h20M4 7v4m4-4v4m4-4v4m4-4v4m4-4v4"/>',
  archaeological: '<path d="m2 6 10-4 10 4H2Zm2 3h16M5 9v10m3-10v10m3-10v10m3-10v10m3-10v10m3-10v10M3 19h18M2 22h20"/>',
  monument: '<path d="m9 19 1-14 2-3 2 3 1 14M7 19h10v3H7ZM10 5h4M12 6v10"/>',
};
export function markerSvg(type) {
  const shape = shapes[type] || shapes.monument;
  return `<svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shape}</svg>`;
}
export function isKosovo(feature) {
  return feature?.properties?.ADMIN === 'Kosovo' || feature?.properties?.NAME === 'Kosovo';
}
export function countryStyle(feature) {
  return isKosovo(feature)
    ? { fillColor: '#E8B931', color: '#8A6D0B', weight: 2, fillOpacity: 1 }
    : { fillColor: '#E9DCC3', color: '#CDBA99', weight: 1, fillOpacity: 1 };
}
const normalize = (value) => String(value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
export function filterMonuments(monuments, query) {
  const text = normalize(query.trim());
  return monuments.filter((monument) => normalize(monument.name_en).includes(text) || normalize(monument.name_sq).includes(text) || normalize(monument.slug?.replaceAll('-', ' ')).includes(text));
}
export function validMonuments(records) {
  if (!Array.isArray(records)) throw new Error('Invalid monument list');
  return records.filter((record) => record && typeof record.slug === 'string' && typeof record.name_en === 'string' && record.lat !== null && record.lng !== null && Number.isFinite(Number(record.lat)) && Number.isFinite(Number(record.lng)) && Number(record.lat) >= 39 && Number(record.lat) <= 46 && Number(record.lng) >= 17 && Number(record.lng) <= 25).map((record) => ({ ...record, lat: Number(record.lat), lng: Number(record.lng) }));
}
export function monumentSources(value) {
  let records = value;
  if (typeof records === 'string') { try { records = JSON.parse(records); } catch { return []; } }
  if (!Array.isArray(records)) return [];
  return records.flatMap((record) => {
    const text = typeof record === 'string' ? record : record?.url;
    try {
      const url = new URL(text);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return [];
      return [{ url: url.href, title: record?.title || url.hostname }];
    } catch { return []; }
  });
}
export function monumentImageUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  // Accept local public assets or HTTPS photographs; reject active URL schemes.
  if (/^\/(?!\/)/.test(value)) return value;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}
