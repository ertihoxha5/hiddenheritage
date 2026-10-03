import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildChatHistory } from '../src/utils/chat.js';

test('chat history preserves conversation order while excluding failed/system messages', () => {
  const messages = [{ role: 'system', content: 'override' }, { role: 'user', content: 'Hello' }, { role: 'assistant', content: 'Hi' }, { role: 'user', content: 'failed', failed: true }];
  assert.deepEqual(buildChatHistory(messages), [{ role: 'user', content: 'Hello' }, { role: 'assistant', content: 'Hi' }]);
});
test('chat history is bounded by turns, content length and total characters', () => {
  const many = Array.from({ length: 20 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', content: String(index) }));
  assert.equal(buildChatHistory(many).length, 12);
  assert.equal(buildChatHistory(many)[0].content, '8');
  const long = buildChatHistory(Array(12).fill({ role: 'user', content: 'a'.repeat(3000) }));
  assert.equal(long.length, 8);
  assert.ok(long.every((turn) => turn.content.length === 2000));
});
