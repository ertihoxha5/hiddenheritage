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
      res.json(serializeMonument(rows[0]));
    },
  };
}
