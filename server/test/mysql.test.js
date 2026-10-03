import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import mysql from 'mysql2/promise';
import { createApp } from '../src/app.js';

// Optional integration test uses an isolated *_test database, never the app DB.
test('live MySQL: all routes, persistence, and concurrent refresh rotation', { skip: !process.env.TEST_DB_NAME }, async () => {
  const database = process.env.TEST_DB_NAME;
  assert.match(database, /^[a-zA-Z0-9_]+_test$/);
  assert.notEqual(database, process.env.DB_NAME || 'hidden_heritage');
  const settings = { host: process.env.DB_HOST || 'localhost', user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', timezone: 'Z', connectTimeout: 10000 };
  const admin = await mysql.createConnection(settings);
  try {
    await admin.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  } finally { await admin.end(); }
  const db = mysql.createPool({ ...settings, database, connectionLimit: 5 });
  let server;
  const unique = randomUUID();
  const email = `test-${unique}@example.com`;
  const slug = `test-${unique}`;
  try {
    const schema = await readFile(new URL('../schema.sql', import.meta.url), 'utf8');
    for (const sql of schema.split(';').map((value) => value.trim()).filter((value) => value.startsWith('CREATE TABLE'))) await db.query(sql);
    server = createApp({ db, accessSecret: 'mysql-test-access-secret', refreshSecret: 'mysql-test-refresh-secret', production: false }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    async function request(path, { body, cookie, token } = {}) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
    }
    assert.equal((await request('/health')).status, 200);
    assert.equal((await request('/auth/me')).status, 401);
    assert.equal((await request('/monuments')).status, 401);
    assert.equal((await request(`/monuments/${slug}`)).status, 401);
    assert.equal((await request('/auth/register', { body: { email: 'bad' } })).status, 400);
    const account = { full_name: 'Integration Test', email, password: 'heritage-test-123', role: 'teacher' };
    assert.equal((await request('/auth/register', { body: account })).status, 201);
    assert.equal((await request('/auth/register', { body: account })).status, 409);
    assert.equal((await request('/auth/login', { body: { email, password: 'wrong-password' } })).status, 401);
    const session = await request('/auth/login', { body: { email, password: account.password } });
    assert.equal(session.status, 200);
    const token = session.body.accessToken;
    assert.equal((await request('/auth/me', { token })).body.email, email);
    assert.equal((await request('/contact', { body: { name: 'Integration Test', email, message: 'Test contact' } })).status, 201);
    const [messages] = await db.execute('SELECT message FROM contact_messages WHERE email = ?', [email]);
    assert.equal(messages[0].message, 'Test contact');
    await db.execute('INSERT INTO monuments (slug, name_en, name_sq, type, municipality, lat, lng, sources) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [slug, 'Test Castle', 'Test', 'castle', 'Test', 42.123456, 20.654321, JSON.stringify(['https://example.com'])]);
    const list = await request('/monuments', { token });
    assert.equal(list.status, 200);
    assert.ok(list.body.some((monument) => monument.slug === slug && monument.lat === 42.123456));
    const detail = await request(`/monuments/${slug}`, { token });
    assert.equal(detail.status, 200);
    assert.deepEqual(detail.body.sources, ['https://example.com']);
    assert.equal((await request('/monuments/missing-test-monument', { token })).status, 404);
    const rotations = await Promise.all([request('/auth/refresh', { body: {}, cookie: session.cookie }), request('/auth/refresh', { body: {}, cookie: session.cookie })]);
    assert.deepEqual(rotations.map((result) => result.status).sort(), [200, 401]);
    const rotated = rotations.find((result) => result.status === 200);
    assert.notEqual(rotated.cookie, session.cookie);
    assert.equal((await request('/auth/logout', { body: {}, cookie: rotated.cookie })).status, 200);
    assert.equal((await request('/auth/refresh', { body: {}, cookie: rotated.cookie })).status, 401);
    const [activeTokens] = await db.execute('SELECT id FROM refresh_tokens WHERE user_id = ? AND revoked = FALSE', [session.body.user.id]);
    assert.equal(activeTokens.length, 0);
    for (let attempt = 0; attempt < 8; attempt++) assert.equal((await request('/auth/login', { body: { email, password: 'wrong-password' } })).status, 401);
    assert.equal((await request('/auth/login', { body: { email, password: account.password } })).status, 429);
  } finally {
    if (server) await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
    try {
      await db.execute('DELETE FROM users WHERE email = ?', [email]);
      await db.execute('DELETE FROM contact_messages WHERE email = ?', [email]);
      await db.execute('DELETE FROM monuments WHERE slug = ?', [slug]);
    } finally { await db.end(); }
  }
});
