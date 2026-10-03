export function health(_req, res) {
  res.json({ status: 'ok', service: 'hidden-heritage-api' });
}
