function serializeMonument(row) {
  return { ...row, lat: Number(row.lat), lng: Number(row.lng) };
}

export function createMonumentController(db) {
  return {
    async list(_req, res) {
      const [rows] = await db.execute('SELECT id, slug, name_en, type, lat, lng FROM monuments ORDER BY name_en');
      res.json(rows.map(serializeMonument));
    },
    async detail(req, res) {
      const [rows] = await db.execute('SELECT * FROM monuments WHERE slug = ?', [req.params.slug]);
      if (!rows[0]) return res.status(404).json({ error: 'Monument not found' });
      res.json({ ...serializeMonument(rows[0]), ...await reconstructionDetails(rows[0].slug) });
    },
  };
}
import { readFile } from 'node:fs/promises';

async function reconstructionDetails(slug) {
  try {
    const records = JSON.parse(await readFile(new URL('../../data/monuments.json', import.meta.url), 'utf8'));
    const record = records.find((monument) => monument.slug === slug);
    if (!record) return {};
    // These optional researched fields do not require a database schema migration.
    return Object.fromEntries(['original_appearance', 'reconstruction_period', 'surroundings', 'reconstruction_note'].filter((key) => typeof record[key] === 'string').map((key) => [key, record[key]]));
  } catch { return {}; }
}
