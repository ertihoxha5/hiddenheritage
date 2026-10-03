import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { pool } from './db.js';

const monumentSchema = z.object({
  slug: z.string().min(1).max(150),
  name_en: z.string().min(1).max(255),
  name_sq: z.string().min(1).max(255),
  type: z.enum(['castle', 'church', 'mosque', 'monument', 'bridge', 'archaeological', 'tower']),
  municipality: z.string().min(1).max(150),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  built_period: z.string().max(255).nullish(),
  short_description: z.string().max(1000).nullish(),
  history: z.string().nullish(),
  image_now: z.string().max(500).nullish(),
  image_now_credit: z.string().max(1000).nullish(),
  image_then: z.string().max(500).nullish(),
  sources: z.array(z.string()).default([]),
});
const columns = ['slug', 'name_en', 'name_sq', 'type', 'municipality', 'lat', 'lng', 'built_period', 'short_description', 'history', 'image_now', 'image_now_credit', 'image_then', 'sources'];

let connection;
try {
  const input = JSON.parse(await readFile(new URL('../data/monuments.json', import.meta.url), 'utf8'));
  const monuments = z.array(monumentSchema).parse(input);
  if (new Set(monuments.map((item) => item.slug)).size !== monuments.length) throw new Error('Duplicate monument slugs in seed data');
  if (monuments.length === 0) {
    console.log('No monuments to seed. Add records to server/data/monuments.json.');
  } else {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const sql = `INSERT INTO monuments (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')}) ON DUPLICATE KEY UPDATE ${columns.slice(1).map((column) => `${column} = VALUES(${column})`).join(', ')}`;
    for (const monument of monuments) {
      await connection.execute(sql, columns.map((column) => column === 'sources' ? JSON.stringify(monument.sources) : monument[column] ?? null));
    }
    await connection.commit();
    console.log(`Seeded ${monuments.length} monuments.`);
  }
} catch (error) {
  if (connection) await connection.rollback();
  console.error('Seed failed:', error.message);
  process.exitCode = 1;
} finally {
  connection?.release();
  await pool.end();
}
