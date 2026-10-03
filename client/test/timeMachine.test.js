import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validatePhotoFile, preparePhoto, MAX_IMAGE_BYTES } from '../src/utils/timeMachineImages.js';

function browser(t, { width = 1200, height = 800, convertedSize = 8, unreadable = false } = {}) {
  const originalImage = globalThis.Image;
  const originalDocument = globalThis.document;
  const calls = [];
  const created = [];
  const revoked = [];
  t.mock.method(URL, 'createObjectURL', () => { const url = `blob:test-${created.length}`; created.push(url); return url; });
  t.mock.method(URL, 'revokeObjectURL', (url) => revoked.push(url));
  globalThis.Image = class {
    naturalWidth = width;
    naturalHeight = height;
    set src(value) { if (value) queueMicrotask(() => unreadable ? this.onerror?.() : this.onload?.()); }
  };
  const context = {
    drawImage(...args) { calls.push(['drawImage', ...args.slice(1)]); },
  };
  globalThis.document = {
    createElement(tag) {
      assert.equal(tag, 'canvas', 'SVG must never be injected into an element');
      return { width: 0, height: 0, getContext: () => context, toBlob(callback, type) { assert.equal(type, 'image/png'); callback(new Blob([new Uint8Array(convertedSize)], { type })); } };
    },
  };
  t.after(() => {
    if (originalImage === undefined) delete globalThis.Image; else globalThis.Image = originalImage;
    if (originalDocument === undefined) delete globalThis.document; else globalThis.document = originalDocument;
  });
  return { calls, created, revoked };
}

test('accepted image extensions, matching MIME and the 5 MB limit are validated', () => {
  for (const [name, type] of [['photo.png', 'image/png'], ['photo.JPG', 'image/jpeg'], ['photo.jpeg', 'image/jpeg'], ['photo.svg', 'image/svg+xml']]) assert.ok(validatePhotoFile(new File(['image'], name, { type })));
  assert.throws(() => validatePhotoFile(new File(['gif'], 'photo.gif', { type: 'image/gif' })), /PNG, JPG, JPEG, or SVG/);
  assert.throws(() => validatePhotoFile(new File(['data'], 'photo.png', { type: 'text/html' })));
  assert.throws(() => validatePhotoFile(new File([], 'photo.png', { type: 'image/png' })), /empty/);
  assert.throws(() => validatePhotoFile(new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], 'photo.png', { type: 'image/png' })), /5 MB/);
});

test('SVG is drawn through Image and canvas, uploaded as PNG, and source URL is released', async (t) => {
  const mock = browser(t);
  const file = new File(['<svg xmlns="http://www.w3.org/2000/svg"><script>bad()</script></svg>'], 'place.svg', { type: 'image/svg+xml' });
  const result = await preparePhoto(file);
  assert.equal(result.type, 'image/png');
  assert.equal(result.name, 'reference.png');
  assert.ok(mock.calls.some((call) => call[0] === 'drawImage'));
  assert.deepEqual(mock.created, mock.revoked);
});

test('PNG/JPEG are retained and empty MIME types are normalized for multipart upload', async (t) => {
  browser(t);
  const file = new File(['png-data'], 'photo.png', { type: 'image/png' });
  assert.equal(await preparePhoto(file), file);
  assert.equal((await preparePhoto(new File(['jpeg-data'], 'photo.jpg'))).type, 'image/jpeg');
});

test('unreadable or huge images and oversized converted SVGs fail safely', async (t) => {
  await t.test('unreadable', async (t) => {
    const mock = browser(t, { unreadable: true });
    await assert.rejects(preparePhoto(new File(['bad'], 'image.png', { type: 'image/png' })), /could not be read/);
    assert.deepEqual(mock.created, mock.revoked);
  });
  await t.test('too many pixels', async (t) => {
    browser(t, { width: 50000, height: 50000 });
    await assert.rejects(preparePhoto(new File(['data'], 'image.png', { type: 'image/png' })), /40 megapixels/);
  });
  await t.test('converted SVG too large', async (t) => {
    browser(t, { convertedSize: MAX_IMAGE_BYTES + 1 });
    await assert.rejects(preparePhoto(new File(['svg-data'], 'image.svg', { type: 'image/svg+xml' })), /converted SVG exceeds/);
  });
});
