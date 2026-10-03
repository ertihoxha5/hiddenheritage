import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { hashToken } from '../src/services/tokens.js';
import { createMemoryDb } from './helpers/memoryDb.js';

const accessSecret = 'test-access-secret-for-http-tests-only';
const refreshSecret = 'test-refresh-secret-for-http-tests-only';
const account = { full_name: 'Demo Guide', email: 'guide@example.com', password: 'heritage123', role: 'guide' };

async function fixture(t, production = false) {
  const db = createMemoryDb();
  const server = createApp({ db, accessSecret, refreshSecret, production }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  async function request(path, { method = 'GET', body, cookie, token, raw } = {}) {
    const headers = {};
    if (body !== undefined || raw !== undefined) headers['Content-Type'] = 'application/json';
    if (cookie) headers.Cookie = cookie;
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
      method, headers, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
    });
    return { status: response.status, body: await response.json(), headers: response.headers, cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  const post = (path, body, options = {}) => request(path, { method: 'POST', body, ...options });
  async function login() {
    assert.equal((await post('/auth/register', account)).status, 201);
    const response = await post('/auth/login', { email: account.email, password: account.password });
    assert.equal(response.status, 200);
    return response;
  }
  return { db, request, post, login };
}

test('register validates input, normalizes email, hashes with 10 rounds, and never logs in', async (t) => {
  const { db, post } = await fixture(t);
  for (const input of [undefined, {}, { ...account, full_name: ' ' }, { ...account, email: 'invalid' }, { ...account, password: 'short' }, { ...account, password: 'é'.repeat(40) }, { ...account, role: 'admin' }]) {
    const result = await post('/auth/register', input);
    assert.equal(result.status, 400);
    assert.equal(typeof result.body.error, 'string');
  }
  const result = await post('/auth/register', { full_name: ' Tourist ', email: 'TOURIST@example.com', password: account.password });
  assert.equal(result.status, 201);
  assert.deepEqual(Object.keys(result.body), ['message']);
  assert.equal(result.cookie, undefined);
  assert.equal(db.state.refreshTokens.length, 0);
  const user = db.state.users[0];
  assert.equal(user.role, 'tourist');
  assert.equal(user.full_name, 'Tourist');
  assert.equal(user.email, 'tourist@example.com');
  assert.equal(bcrypt.getRounds(user.password_hash), 10);
  assert.ok(await bcrypt.compare(account.password, user.password_hash));
  assert.equal((await post('/auth/register', { ...account, email: 'Tourist@example.com' })).status, 409);
});

test('health stays public and CORS allows credentialed client requests', async (t) => {
  const { request } = await fixture(t);
  const result = await request('/health');
  assert.deepEqual(result.body, { status: 'ok', service: 'hidden-heritage-api' });
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('access-control-allow-origin'), process.env.CLIENT_URL || 'http://localhost:5173');
  assert.equal(result.headers.get('access-control-allow-credentials'), 'true');
});

test('login returns a 15-minute access JWT, public user, and hashed 7-day cookie', async (t) => {
  const { db, post, login, request } = await fixture(t);
  const result = await login();
  assert.deepEqual(result.body.user, { id: 1, full_name: account.full_name, email: account.email, role: account.role });
  assert.equal(result.body.refreshToken, undefined);
  const access = jwt.verify(result.body.accessToken, accessSecret);
  assert.equal(access.sub, '1');
  assert.equal(access.role, 'guide');
  assert.equal(access.exp - access.iat, 900);
  const rawToken = result.cookie.slice('refreshToken='.length);
  const refresh = jwt.verify(rawToken, refreshSecret);
  assert.equal(refresh.exp - refresh.iat, 604800);
  assert.ok(refresh.jti);
  assert.equal(db.state.refreshTokens[0].token_hash, hashToken(rawToken));
  assert.notEqual(db.state.refreshTokens[0].token_hash, rawToken);
  assert.equal(db.state.refreshTokens[0].expires_at.getTime(), refresh.exp * 1000);
  assert.match(result.headers.get('set-cookie'), /HttpOnly/);
  assert.match(result.headers.get('set-cookie'), /SameSite=Lax/);
  assert.match(result.headers.get('set-cookie'), /Path=\/api\/auth/);
  assert.match(result.headers.get('set-cookie'), /Max-Age=604800/);
  assert.doesNotMatch(result.headers.get('set-cookie'), /Secure/);
  assert.equal(result.headers.get('cache-control'), 'no-store');
  assert.deepEqual((await request('/auth/me', { token: result.body.accessToken })).body, result.body.user);
  const wrongEmail = await post('/auth/login', { email: 'missing@example.com', password: account.password });
  const wrongPassword = await post('/auth/login', { email: account.email, password: 'wrongpassword' });
  assert.equal(wrongEmail.status, 401);
  assert.equal(wrongPassword.status, 401);
  assert.deepEqual(wrongEmail.body, wrongPassword.body);
  assert.equal((await post('/auth/login', { email: 'invalid', password: 'short' })).status, 400);
});

test('production refresh cookies include Secure', async (t) => {
  const { login } = await fixture(t, true);
  assert.match((await login()).headers.get('set-cookie'), /; Secure/);
});

test('refresh rotates, rejects replay, and logout revokes and clears the matching cookie', async (t) => {
  const { db, login, post, request } = await fixture(t);
  const session = await login();
  const rotated = await post('/auth/refresh', undefined, { cookie: session.cookie });
  assert.equal(rotated.status, 200);
  assert.notEqual(rotated.cookie, session.cookie);
  assert.deepEqual(rotated.body.user, session.body.user);
  assert.equal((await request('/auth/me', { token: rotated.body.accessToken })).status, 200);
  assert.equal(db.state.refreshTokens[0].revoked, true);
  assert.equal(db.state.refreshTokens[1].revoked, false);
  assert.equal((await post('/auth/refresh', undefined, { cookie: session.cookie })).status, 401);
  const logout = await post('/auth/logout', undefined, { cookie: rotated.cookie });
  assert.equal(logout.status, 200);
  assert.equal(db.state.refreshTokens[1].revoked, true);
  assert.match(logout.headers.get('set-cookie'), /refreshToken=;/);
  assert.match(logout.headers.get('set-cookie'), /Path=\/api\/auth/);
  assert.match(logout.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);
  assert.equal((await post('/auth/refresh', undefined, { cookie: rotated.cookie })).status, 401);
  assert.equal((await post('/auth/logout')).status, 200);
  // Access JWTs remain valid until their 15-minute expiry after logout.
  assert.equal((await request('/auth/me', { token: session.body.accessToken })).status, 200);
});

test('refresh rejects absent, malformed, forged, expired, missing, revoked and mismatched tokens', async (t) => {
  const { db, login, post } = await fixture(t);
  const session = await login();
  const cookie = (token) => `refreshToken=${token}`;
  for (const value of [undefined, 'refreshToken=bad-token', cookie(jwt.sign({}, accessSecret, { subject: '1' })), cookie(jwt.sign({}, refreshSecret, { subject: '1', expiresIn: -1 })), cookie(jwt.sign({}, refreshSecret, { subject: '1', jwtid: 'not-stored' }))]) {
    const result = await post('/auth/refresh', undefined, { cookie: value });
    assert.equal(result.status, 401);
    assert.equal(typeof result.body.error, 'string');
  }
  const stored = db.state.refreshTokens[0];
  stored.revoked = true;
  assert.equal((await post('/auth/refresh', undefined, { cookie: session.cookie })).status, 401);
  db.state.refreshTokens[0].revoked = false;
  const expiry = db.state.refreshTokens[0].expires_at;
  db.state.refreshTokens[0].expires_at = new Date(0);
  assert.equal((await post('/auth/refresh', undefined, { cookie: session.cookie })).status, 401);
  db.state.refreshTokens[0].expires_at = expiry;
  db.state.refreshTokens[0].user_id = 99;
  assert.equal((await post('/auth/refresh', undefined, { cookie: session.cookie })).status, 401);
  db.state.refreshTokens[0].user_id = 1;
  db.state.users = [];
  assert.equal((await post('/auth/refresh', undefined, { cookie: session.cookie })).status, 401);
});

test('refresh rollback preserves the old session if replacement storage fails', async (t) => {
  const { db, login, post } = await fixture(t);
  const session = await login();
  db.failNextTokenInsert = true;
  const failed = await post('/auth/refresh', undefined, { cookie: session.cookie });
  assert.equal(failed.status, 500);
  assert.deepEqual(failed.body, { error: 'Something went wrong. Please try again.' });
  assert.equal(failed.cookie, undefined);
  assert.equal(db.state.refreshTokens[0].revoked, false);
  assert.equal(db.state.refreshTokens.length, 1);
  assert.equal((await post('/auth/refresh', undefined, { cookie: session.cookie })).status, 200);
});

test('two concurrent refresh requests have only one winner', async (t) => {
  const { db, login, post } = await fixture(t);
  const session = await login();
  const results = await Promise.all([post('/auth/refresh', undefined, { cookie: session.cookie }), post('/auth/refresh', undefined, { cookie: session.cookie })]);
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 401]);
  assert.equal(db.state.refreshTokens.filter((token) => !token.revoked).length, 1);
});

test('all protected routes reject missing, invalid, forged and expired access tokens', async (t) => {
  const { request, login, db } = await fixture(t);
  for (const path of ['/auth/me', '/monuments', '/monuments/test-castle']) {
    for (const token of [undefined, 'invalid', jwt.sign({ role: 'guide' }, refreshSecret, { subject: '1' }), jwt.sign({ role: 'guide' }, accessSecret, { subject: '1', expiresIn: -1 }), jwt.sign({ role: 'admin' }, accessSecret, { subject: '1' }), jwt.sign({ role: 'guide' }, accessSecret, { subject: 'invalid' })]) {
      const result = await request(path, { token });
      assert.equal(result.status, 401);
      assert.deepEqual(result.body, { error: 'Unauthorized' });
    }
  }
  const session = await login();
  db.state.users = [];
  assert.equal((await request('/auth/me', { token: session.body.accessToken })).status, 401);
});

test('contact validates and saves trimmed input; malformed JSON and unknown routes return JSON errors', async (t) => {
  const { db, post, request } = await fixture(t);
  for (const body of [{}, { name: ' ', email: 'a@example.com', message: 'Hi' }, { name: 'A', email: 'bad', message: 'Hi' }, { name: 'A', email: 'a@example.com', message: ' ' }, { name: 'A', email: 'a@example.com', message: 'x'.repeat(10001) }]) {
    assert.equal((await post('/contact', body)).status, 400);
  }
  const result = await post('/contact', { name: ' Teacher ', email: 'TEACHER@example.com', message: ' A class visit ' });
  assert.equal(result.status, 201);
  assert.deepEqual(db.state.contacts, [{ name: 'Teacher', email: 'teacher@example.com', message: 'A class visit' }]);
  assert.deepEqual((await request('/contact', { method: 'POST', raw: '{' })).body, { error: 'Invalid JSON body' });
  assert.equal((await request('/missing')).status, 404);
});

test('monuments list returns only map fields and detail returns the full record with numeric coordinates', async (t) => {
  const { db, login, request } = await fixture(t);
  const { body: { accessToken: token } } = await login();
  assert.deepEqual((await request('/monuments', { token })).body, []);
  db.state.monuments.push({ id: 1, slug: 'test-castle', name_en: 'Test Castle', name_sq: 'Test', type: 'castle', municipality: 'Test', lat: '42.123456', lng: '20.654321', built_period: 'Test', short_description: 'Test fixture', history: 'Test history', image_now: null, image_now_credit: null, image_then: null, sources: ['https://example.com'] });
  const list = await request('/monuments', { token });
  assert.equal(list.status, 200);
  assert.deepEqual(list.body, [{ id: 1, slug: 'test-castle', name_en: 'Test Castle', type: 'castle', lat: 42.123456, lng: 20.654321 }]);
  const detail = await request('/monuments/test-castle', { token });
  assert.equal(detail.status, 200);
  assert.deepEqual(detail.body, { ...db.state.monuments[0], lat: 42.123456, lng: 20.654321 });
  assert.deepEqual((await request('/monuments/missing', { token })).body, { error: 'Monument not found' });
  assert.equal((await request('/monuments/missing', { token })).status, 404);
});

test('login allows 10 requests per minute and returns a JSON 429 on the eleventh', async (t) => {
  const { post } = await fixture(t);
  for (let attempt = 0; attempt < 10; attempt++) {
    assert.equal((await post('/auth/login', { email: account.email, password: account.password })).status, 401);
  }
  const limited = await post('/auth/login', { email: account.email, password: account.password });
  assert.equal(limited.status, 429);
  assert.equal(typeof limited.body.error, 'string');
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
  assert.ok(limited.headers.get('ratelimit'));
  assert.equal((await post('/contact', { name: 'Test', email: account.email, message: 'Still available' })).status, 201);
});
