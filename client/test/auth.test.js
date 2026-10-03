import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AxiosError } from 'axios';
import { createAuthClient } from '../src/api/axios.js';
import { validateForm } from '../src/utils/validation.js';

const user = { id: 1, full_name: 'Demo Guide', email: 'demo@example.com', role: 'guide' };
function response(config, data, status = 200) {
  const result = { config, data, status, statusText: '', headers: {} };
  if (status >= 400) throw new AxiosError('HTTP error', 'ERR_BAD_REQUEST', config, null, result);
  return result;
}
const delay = () => new Promise((resolve) => setTimeout(resolve, 10));

test('login keeps tokens in memory, attaches bearer auth, and logout clears the session', async () => {
  const requests = [];
  const client = createAuthClient('/api', async (config) => {
    requests.push(config);
    if (config.url === '/auth/login') return response(config, { accessToken: 'token', user });
    return response(config, {});
  });
  assert.deepEqual(client.getSession(), { user: null, accessToken: null });
  assert.deepEqual(await client.login({ email: user.email, password: 'heritage123' }), user);
  await client.api.get('/monuments');
  assert.equal(requests[1].headers.get('Authorization'), 'Bearer token');
  assert.ok(requests.every((config) => config.withCredentials));
  await client.logout();
  assert.deepEqual(client.getSession(), { user: null, accessToken: null });
  assert.equal(requests.at(-1).url, '/auth/logout');
});

test('concurrent startup refresh calls share a single rotating request', async () => {
  let count = 0;
  const client = createAuthClient('/api', async (config) => { count++; await delay(); return response(config, { user, accessToken: 'restored' }); });
  await Promise.all([client.refresh(), client.refresh()]);
  assert.equal(count, 1);
  assert.equal(client.getSession().accessToken, 'restored');
});

test('concurrent 401 responses share one refresh and retry with the new token', async () => {
  let refreshes = 0;
  let retries = 0;
  const client = createAuthClient('/api', async (config) => {
    if (config.url === '/auth/login') return response(config, { user, accessToken: 'old' });
    if (config.url === '/auth/refresh') { refreshes++; await delay(); return response(config, { user, accessToken: 'new' }); }
    if (config.headers.get('Authorization') === 'Bearer old') return response(config, {}, 401);
    assert.equal(config.headers.get('Authorization'), 'Bearer new'); retries++;
    return response(config, ['ok']);
  });
  await client.login({});
  const results = await Promise.all([client.api.get('/monuments'), client.api.get('/auth/me')]);
  assert.equal(refreshes, 1);
  assert.equal(retries, 2);
  assert.ok(results.every((result) => result.data[0] === 'ok'));
});

test('a delayed old-token 401 reuses the token another request already refreshed', async () => {
  let refreshes = 0;
  const client = createAuthClient('/api', async (config) => {
    if (config.url === '/auth/login') return response(config, { user, accessToken: 'old' });
    if (config.url === '/auth/refresh') { refreshes++; return response(config, { user, accessToken: 'new' }); }
    if (config.headers.get('Authorization') === 'Bearer old') {
      if (config.url === '/slow') await delay();
      return response(config, {}, 401);
    }
    return response(config, {});
  });
  await client.login({});
  await Promise.all([client.api.get('/fast'), client.api.get('/slow')]);
  assert.equal(refreshes, 1);
});

test('failed refresh clears auth and publishes expiration; login errors never refresh', async () => {
  let refreshes = 0;
  let expired = false;
  let rejectLogin = false;
  const client = createAuthClient('/api', async (config) => {
    if (config.url === '/auth/login' && !rejectLogin) return response(config, { user, accessToken: 'old' });
    if (config.url === '/auth/refresh') refreshes++;
    return response(config, { error: 'Unauthorized' }, 401);
  });
  client.subscribe((_session, event) => { expired ||= event; });
  await client.login({});
  await assert.rejects(client.api.get('/monuments'));
  assert.equal(refreshes, 1);
  assert.ok(expired);
  assert.equal(client.getSession().accessToken, null);
  rejectLogin = true;
  await assert.rejects(client.login({}));
  await assert.rejects(client.api.post('/auth/register', {}));
  assert.equal(refreshes, 1);
});

test('a retried 401 stops after one refresh instead of looping', async () => {
  let refreshes = 0;
  const client = createAuthClient('/api', async (config) => {
    if (config.url === '/auth/login') return response(config, { user, accessToken: 'old' });
    if (config.url === '/auth/refresh') { refreshes++; return response(config, { user, accessToken: 'new' }); }
    return response(config, {}, 401);
  });
  await client.login({});
  await assert.rejects(client.api.get('/monuments'));
  assert.equal(refreshes, 1);
  assert.equal(client.getSession().user, null);
});

test('logout during restoration prevents the late response from logging the user back in', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const client = createAuthClient('/api', async (config) => {
    if (config.url === '/auth/refresh') { await gate; return response(config, { user, accessToken: 'late' }); }
    return response(config, {});
  });
  const pending = client.refresh();
  const rejected = assert.rejects(pending);
  const logout = client.logout();
  release();
  await Promise.all([rejected, logout]);
  assert.deepEqual(client.getSession(), { user: null, accessToken: null });
});

test('stale 401 after logout cannot restore a revoked session', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let refreshes = 0;
  const client = createAuthClient('/api', async (config) => {
    if (config.url === '/auth/login') return response(config, { user, accessToken: 'old' });
    if (config.url === '/slow') { await gate; return response(config, {}, 401); }
    if (config.url === '/auth/refresh') refreshes++;
    return response(config, {});
  });
  await client.login({});
  const request = client.api.get('/slow');
  const rejected = assert.rejects(request);
  await delay();
  await client.logout(); release(); await rejected;
  assert.equal(refreshes, 0);
});

test('form validation catches empty fields, invalid email, mismatched and oversized passwords', () => {
  const good = { full_name: 'Guide', email: 'demo@example.com', password: 'heritage123', confirmPassword: 'heritage123', role: 'guide' };
  assert.deepEqual(validateForm(good, 'signup'), {});
  assert.ok(validateForm({ ...good, confirmPassword: 'other' }, 'signup').confirmPassword);
  assert.ok(validateForm({ ...good, password: 'short' }, 'login').password);
  assert.ok(validateForm({ ...good, password: 'é'.repeat(40) }, 'login').password);
  assert.ok(validateForm({ ...good, email: 'bad' }, 'login').email);
  assert.ok(validateForm({ name: ' ', email: good.email, message: ' ' }, 'contact').name);
  assert.ok(validateForm({ name: 'Guide', email: good.email, message: ' ' }, 'contact').message);
});
