// Optional live smoke check. Requires server/.env and uses real Groq requests.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import jwt from 'jsonwebtoken';
import Groq from 'groq-sdk';
import { createApp } from './app.js';
import { loadChatMonuments } from './services/chatContext.js';

if (!process.env.GROQ_API_KEY || !process.env.GROQ_MODEL) {
  console.error('Set GROQ_API_KEY and GROQ_MODEL in server/.env first.');
  process.exit(1);
}
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: 20000, maxRetries: 0, logLevel: 'off' });
try {
  const models = await groq.models.list();
  assert.ok(models.data.some((model) => model.id === process.env.GROQ_MODEL), 'Configured Groq model is not available');
} catch (error) {
  console.error('Groq model verification failed', { status: Number.isInteger(error.status) ? error.status : undefined });
  process.exit(1);
}
const records = await loadChatMonuments();
const monument = records.find((record) => record.slug === 'ulpiana') || records[0];
const secret = 'live-chat-local-test-secret';
const server = createApp({ accessSecret: secret, refreshSecret: 'live-chat-local-refresh-secret' }).listen(0, '127.0.0.1');
await once(server, 'listening');
const token = jwt.sign({ role: 'tourist' }, secret, { subject: '1', expiresIn: '5m' });
async function ask(label, body) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/chat`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(25000) });
  const result = await response.json();
  assert.equal(response.status, 200, `Live ${label} request failed (${response.status})`);
  assert.ok(result.answer?.trim());
  assert.ok(Array.isArray(result.sources));
  console.log(JSON.stringify({ check: label, ...result }, null, 2));
  return result;
}
try {
  const albanian = await ask('Albanian + selected monument', { message: `Çfarë mund të më tregosh për ${monument.name_en}? Përmend burimet.`, monumentId: monument.slug, language: 'sq', history: [] });
  assert.ok(albanian.sources.length > 0, 'Selected-monument answer did not cite supplied evidence');
  const first = await ask('English + selected monument', { message: `Explain the documented historical phases of ${monument.name_en}. Cite the supplied evidence.`, monumentId: monument.slug, language: 'en', history: [] });
  assert.ok(first.sources.length > 0);
  await ask('Conversation continuity', { message: 'Explain that in simpler terms for a student.', monumentId: monument.slug, language: 'en', history: [{ role: 'user', content: `Tell me about ${monument.name_en}.` }, { role: 'assistant', content: first.answer.slice(0, 2000) }] });
  await ask('Unsupported current information', { message: 'What is the exact ticket price today, the opening hours tomorrow, and the name of the first worker who built this site? If the approved records do not say, explain that.', monumentId: monument.slug, language: 'en', history: [] });
  console.log('Live requests passed; inspect the printed answers for language, evidence and uncertainty.');
} catch (error) {
  console.error('Live chat check failed', { check: error.code === 'ERR_ASSERTION' ? error.message : 'Request or configuration failure' });
  process.exitCode = 1;
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
