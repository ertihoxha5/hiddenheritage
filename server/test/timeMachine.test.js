import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { inspectImage, MAX_IMAGE_BYTES } from '../src/middleware/timeMachineUpload.js';
import { reconstructImage, LEONARDO_MODEL, LEONARDO_REFERENCE_STRENGTH, HISTORICAL_PROMPT } from '../src/services/leonardoService.js';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/xkAAAAASUVORK5CYII=', 'base64');
const image = { buffer: png, mimetype: 'image/png', width: 1200, height: 800 };
const imageUrl = 'https://cdn.leonardo.ai/test/reconstruction.jpg';
const slot = { uploadInitImage: { id: 'init-id', url: 'https://test-bucket.s3.amazonaws.com/', fields: JSON.stringify({ key: 'image.png', policy: 'signed-policy' }) } };
const complete = { generations_by_pk: { status: 'COMPLETE', generated_images: [{ url: imageUrl }] } };
const ok = (data) => ({ ok: true, status: 200, json: async () => data });
const logger = { warn() {} };

function provider({ init = slot, uploadStatus = 204, generation = { generationId: 'job-id' }, statuses = [complete], httpFailure, hangingStage, malformedJsonStage } = {}) {
  const calls = [];
  let poll = 0;
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    const stage = url.includes('/init-image') ? 'init' : url.includes('s3.amazonaws.com') ? 'upload' : options.method === 'POST' ? 'generation' : 'poll';
    if (stage === hangingStage) return new Promise(() => {});
    if (stage === httpFailure) return { ok: false, status: 503, json: async () => ({ secret: 'never-expose-this' }) };
    if (stage === malformedJsonStage) return { ok: true, status: 200, json: async () => { throw new Error('bad-json-with-secret'); } };
    if (stage === 'init') return ok(init);
    if (stage === 'upload') return { ok: uploadStatus < 400, status: uploadStatus, text: async () => 'Upload rejected' };
    if (stage === 'generation') return ok(generation);
    return ok(statuses[Math.min(poll++, statuses.length - 1)]);
  };
  return { calls, fetchImpl };
}

test('documented init upload, S3 multipart POST, v2 image reference and v1 result workflow', async () => {
  const mock = provider({ statuses: [{ generations_by_pk: { status: 'PENDING' } }, complete] });
  assert.deepEqual(await reconstructImage(image, { ...mock, apiKey: 'test-key', pollIntervalMs: 1, logger }), { imageUrl });
  assert.equal(mock.calls[0].url, 'https://cloud.leonardo.ai/api/rest/v1/init-image');
  assert.deepEqual(JSON.parse(mock.calls[0].options.body), { extension: 'png' });
  assert.equal(mock.calls[0].options.headers.Authorization, 'Bearer test-key');
  const upload = mock.calls[1].options;
  assert.equal(upload.method, 'POST');
  assert.equal(upload.headers, undefined);
  assert.ok(upload.body instanceof FormData);
  assert.equal(upload.body.get('policy'), 'signed-policy');
  assert.deepEqual(Buffer.from(await upload.body.get('file').arrayBuffer()), png);
  const generation = JSON.parse(mock.calls[2].options.body);
  assert.equal(mock.calls[2].url, 'https://cloud.leonardo.ai/api/rest/v2/generations');
  assert.equal(generation.model, LEONARDO_MODEL);
  assert.equal(generation.public, false);
  assert.equal(generation.parameters.quantity, 1);
  assert.equal(generation.parameters.prompt, HISTORICAL_PROMPT);
  assert.equal(generation.parameters.prompt_enhance, 'OFF');
  assert.equal(generation.parameters.width, 1024);
  assert.equal(generation.parameters.height, 672);
  assert.deepEqual(generation.parameters.guidances.image_reference, [{ image: { id: 'init-id', type: 'UPLOADED' }, strength: LEONARDO_REFERENCE_STRENGTH }]);
  assert.ok(mock.calls.slice(3).every((call) => call.url.endsWith('/v1/generations/job-id')));
});

test('JPEG uses jpg init slot and legacy v2 generation envelope is accepted', async () => {
  const mock = provider({ generation: { generate: { generationId: 'job-id' } } });
  assert.equal((await reconstructImage({ ...image, mimetype: 'image/jpeg' }, { ...mock, apiKey: 'test-key', logger })).imageUrl, imageUrl);
  assert.deepEqual(JSON.parse(mock.calls[0].options.body), { extension: 'jpg' });
});

test('provider failures and malformed responses reject without returning an image', async (t) => {
  const scenarios = [
    ['init HTTP failure', { httpFailure: 'init' }],
    ['upload HTTP failure', { uploadStatus: 403 }],
    ['generation HTTP failure', { httpFailure: 'generation' }],
    ['poll HTTP failure', { httpFailure: 'poll' }],
    ['missing upload slot', { init: {} }],
    ['bad upload fields', { init: { uploadInitImage: { ...slot.uploadInitImage, fields: 'not-json' } } }],
    ['unsafe presigned host', { init: { uploadInitImage: { ...slot.uploadInitImage, url: 'https://localhost/upload' } } }],
    ['missing generation ID', { generation: {} }],
    ['missing status', { statuses: [{}] }],
    ['FAILED', { statuses: [{ generations_by_pk: { status: 'FAILED' } }] }],
    ['unknown status', { statuses: [{ generations_by_pk: { status: 'BOGUS' } }] }],
    ['missing image', { statuses: [{ generations_by_pk: { status: 'COMPLETE', generated_images: [] } }] }],
    ['unsafe result URL', { statuses: [{ generations_by_pk: { status: 'COMPLETE', generated_images: [{ url: 'javascript:alert(1)' }] } }] }],
    ['invalid JSON', { malformedJsonStage: 'generation' }],
  ];
  for (const [name, settings] of scenarios) await t.test(name, async () => {
    const logs = [];
    const mock = provider(settings);
    await assert.rejects(reconstructImage(image, { ...mock, apiKey: 'secret-api-key-never-log', development: false, logger: { warn: (...args) => logs.push(args) } }), (error) => error.status === 502 && Boolean(error.step));
    assert.doesNotMatch(JSON.stringify(logs), /secret-api-key-never-log|never-expose-this|bad-json-with-secret|signed-policy/);
  });
});

test('missing key rejects with 503 without any network calls', async () => {
  const mock = provider();
  await assert.rejects(reconstructImage(image, { ...mock, apiKey: '', logger }), (error) => error.status === 503 && error.step === 'configuration');
  assert.equal(mock.calls.length, 0);
});

test('individual requests, response bodies and total polling have bounded timeouts', async () => {
  for (const hangingStage of ['init', 'upload', 'generation', 'poll']) {
    const mock = provider({ hangingStage });
    const start = Date.now();
    await assert.rejects(reconstructImage(image, { ...mock, apiKey: 'test-key', requestTimeoutMs: 20, totalTimeoutMs: 100, logger }), (error) => error.status === 504);
    assert.ok(Date.now() - start < 500);
  }
  const neverParsed = async () => ({ ok: true, json: () => new Promise(() => {}) });
  await assert.rejects(reconstructImage(image, { fetchImpl: neverParsed, apiKey: 'test-key', requestTimeoutMs: 20, logger }), (error) => error.status === 504);
  const mock = provider({ statuses: [{ generations_by_pk: { status: 'PENDING' } }] });
  const start = Date.now();
  await assert.rejects(reconstructImage(image, { ...mock, apiKey: 'test-key', pollIntervalMs: 5, totalTimeoutMs: 30, logger }), (error) => error.status === 504);
  assert.ok(Date.now() - start < 500);
  const count = mock.calls.length;
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(mock.calls.length, count);
});

test('cancelled client stops the workflow', async () => {
  const controller = new AbortController();
  controller.abort();
  const mock = provider();
  await assert.rejects(reconstructImage(image, { ...mock, apiKey: 'test-key', signal: controller.signal, logger }), (error) => error.status === 504);
  assert.equal(mock.calls.length, 0);
});

test('protected multipart route accepts raster images and rejects invalid/oversized uploads', async (t) => {
  const accessSecret = 'time-machine-test-access-secret';
  const received = [];
  let failureStatus = 0;
  const server = createApp({ accessSecret, refreshSecret: 'time-machine-test-refresh-secret', timeMachineGenerate: async (file) => { received.push(file); if (failureStatus) throw Object.assign(new Error(failureStatus === 504 ? 'Historical reconstruction timed out. Please try again.' : 'Historical reconstruction could not be generated. Please try again.'), { status: failureStatus }); return { imageUrl }; } }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  const token = jwt.sign({ role: 'tourist' }, accessSecret, { subject: '1', expiresIn: '15m' });
  async function post(bytes, type = 'image/png', name = 'photo.png', { auth = true, field = 'image', extra = false } = {}) {
    const body = new FormData();
    if (bytes) body.append(field, new Blob([bytes], { type }), name);
    if (extra) body.append('image', new Blob([png], { type: 'image/png' }), 'extra.png');
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/time-machine`, { method: 'POST', headers: auth ? { Authorization: `Bearer ${token}` } : {}, body });
    return { status: response.status, body: await response.json() };
  }
  assert.equal((await post(png, 'image/png', 'photo.png', { auth: false })).status, 401);
  assert.equal(received.length, 0);
  assert.deepEqual(await post(png), { status: 200, body: { imageUrl } });
  assert.equal(received[0].width, 1);
  assert.deepEqual(received[0].buffer, png);
  assert.equal(received[0].path, undefined);
  for (const [bytes, type, name, options] of [
    [undefined],
    [Buffer.from('<svg/>'), 'image/svg+xml', 'photo.svg'],
    [Buffer.from('not a photo'), 'image/png', 'photo.png'],
    [png, 'image/jpeg', 'photo.jpg'],
    [png, 'image/png', 'photo.txt'],
    [png, 'image/png', 'photo.png', { field: 'file' }],
    [png, 'image/png', 'photo.png', { extra: true }],
  ]) {
    const result = await post(bytes, type, name, options);
    assert.equal(result.status, 400);
    assert.equal(typeof result.body.error, 'string');
  }
  assert.equal((await post(Buffer.alloc(MAX_IMAGE_BYTES + 1))).status, 413);
  assert.equal(received.length, 1);
  for (const status of [502, 503, 504]) {
    failureStatus = status;
    const response = await post(png);
    assert.equal(response.status, status);
    assert.match(response.body.error, /Historical reconstruction/);
    assert.equal(response.body.imageUrl, undefined);
  }
  const huge = Buffer.from(png); huge.writeUInt32BE(50000, 16); huge.writeUInt32BE(50000, 20);
  assert.throws(() => inspectImage(huge, 'image/png'), /40 megapixels/);
});

test('valid JPEG dimensions are recognized, corrupted/truncated JPEGs are rejected', () => {
  const jpeg = Buffer.from([255,216,255,192,0,11,8,0,10,0,20,1,1,17,0,255,217]);
  assert.deepEqual(inspectImage(jpeg, 'image/jpeg'), { width: 20, height: 10 });
  assert.throws(() => inspectImage(jpeg.subarray(0, 10), 'image/jpeg'));
});

test('development logs preserve provider errors and failing step while redacting the key', async () => {
  const logs = [];
  const apiKey = 'private-test-key';
  const fetchImpl = async () => ({ ok: false, status: 422, text: async () => `Invalid guidance; credential=${apiKey}` });
  await assert.rejects(reconstructImage(image, { apiKey, fetchImpl, development: true, logger: { warn: (...args) => logs.push(args) } }), (error) => error.status === 502);
  assert.equal(logs[0][1].stage, 'init-image');
  assert.equal(logs[0][1].providerStatus, 422);
  assert.equal(logs[0][1].providerResponse, 'Invalid guidance; credential=[REDACTED]');
  assert.doesNotMatch(JSON.stringify(logs), /private-test-key/);
  const failed = provider({ statuses: [{ generations_by_pk: { status: 'FAILED', failureReason: 'Insufficient credits' } }] });
  await assert.rejects(reconstructImage(image, { ...failed, apiKey, development: true, logger: { warn: (...args) => logs.push(args) } }), (error) => error.status === 502);
  assert.equal(logs[1][1].stage, 'poll');
  assert.match(logs[1][1].providerResponse, /Insufficient credits/);
});
