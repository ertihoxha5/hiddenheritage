import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { countryStyle, filterMonuments, isKosovo, markerSvg, MONUMENT_TYPES, monumentImageUrl, monumentSources, validMonuments } from '../src/utils/map.js';

test('local Natural Earth map contains Kosovo and neighboring countries', async () => {
  const geo = JSON.parse(await readFile(new URL('../public/geo/countries.geojson', import.meta.url), 'utf8'));
  assert.equal(geo.type, 'FeatureCollection');
  assert.ok(geo.features.length > 200);
  const kosovo = geo.features.filter(isKosovo);
  assert.equal(kosovo.length, 1);
  assert.ok(['Polygon', 'MultiPolygon'].includes(kosovo[0].geometry.type));
  for (const name of ['Albania', 'Serbia', 'Montenegro', 'Macedonia']) assert.ok(geo.features.some(({ properties }) => properties.ADMIN.includes(name) || properties.NAME.includes(name)), name);
});

test('countries use the requested palette', () => {
  assert.deepEqual(countryStyle({ properties: { NAME: 'Kosovo' } }), { fillColor: '#E8B931', color: '#8A6D0B', weight: 2, fillOpacity: 1 });
  assert.deepEqual(countryStyle({ properties: { ADMIN: 'Albania' } }), { fillColor: '#E9DCC3', color: '#CDBA99', weight: 1, fillOpacity: 1 });
});

test('search matches names and slugs regardless of accents or case', () => {
  const records = [{ name_en: 'Prizren Fortress', name_sq: 'Kalaja e Prizrenit', slug: 'prizren-fortress' }, { name_en: 'Tower', name_sq: 'Kulla në Pejë', slug: 'tower' }];
  assert.equal(filterMonuments(records, ' PRIZREN ')[0], records[0]);
  assert.equal(filterMonuments(records, 'peje')[0], records[1]);
  assert.equal(filterMonuments(records, 'prizren fortress')[0], records[0]);
  assert.deepEqual(filterMonuments(records, 'unknown'), []);
});

test('coordinates accept MySQL decimals and reject invalid markers', async () => {
  const record = { slug: 'valid', name_en: 'Valid', lat: '42.6', lng: '20.9' };
  const valid = validMonuments([record, { ...record, lat: null }, { ...record, lng: 'NaN' }, { ...record, lat: 0 }, null]);
  assert.equal(valid.length, 1);
  assert.equal(valid[0].lat, 42.6);
  assert.throws(() => validMonuments({}));
  const dataset = JSON.parse(await readFile(new URL('../../server/data/monuments.json', import.meta.url), 'utf8'));
  assert.equal(validMonuments(dataset).length, dataset.length);
});

test('all types have trusted SVG icons and unknown types have a safe fallback', () => {
  for (const type of MONUMENT_TYPES) assert.match(markerSvg(type), /^<svg .*<path/);
  assert.equal(markerSvg('tower'), markerSvg('monument'));
  assert.equal(markerSvg('<script>alert(1)</script>'), markerSvg('monument'));
});

test('source and image URLs reject active schemes and embedded credentials', () => {
  assert.deepEqual(monumentSources('not json'), []);
  const sources = monumentSources(JSON.stringify(['https://example.com/history', { title: 'Archive', url: 'https://archive.org/item' }, 'javascript:alert(1)', 'https://user:secret@example.com']));
  assert.equal(sources.length, 2);
  assert.equal(sources[1].title, 'Archive');
  assert.equal(monumentImageUrl('/monuments/ulpiana/now.jpg'), '/monuments/ulpiana/now.jpg');
  assert.equal(monumentImageUrl('https://example.com/photo.jpg'), 'https://example.com/photo.jpg');
  for (const value of [null, '', '//example.com/photo.jpg', 'javascript:alert(1)', 'data:image/svg+xml,test', 'https://user:secret@example.com']) assert.equal(monumentImageUrl(value), null);
});
