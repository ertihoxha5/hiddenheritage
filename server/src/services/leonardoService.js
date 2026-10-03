import { buildHistoricalPrompt } from './historicalContext.js';
import { setTimeout as sleep } from 'node:timers/promises';

const LEONARDO_API_BASE = 'https://cloud.leonardo.ai/api/rest';
export const LEONARDO_MODEL = 'flux-kontext-max';
export const LEONARDO_REFERENCE_STRENGTH = 'MID'; // Allow structural changes while retaining the site's identity.
export const LEONARDO_TOTAL_TIMEOUT_MS = 55000;
const LEONARDO_REQUEST_TIMEOUT_MS = 20000;
const LEONARDO_POLL_INTERVAL_MS = 1750;
const NO_STYLE_ID = '556c1ee5-ec38-42e8-955a-1e82dad0ffa1';



const failure = (code, status) => Object.assign(new Error(code), { code, status });
function httpsUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) throw failure('INVALID_IMAGE_URL');
  return url;
}

export async function reconstructImage(file, {
  apiKey = process.env.LEONARDO_API_KEY,
  fetchImpl = fetch,
  totalTimeoutMs = LEONARDO_TOTAL_TIMEOUT_MS,
  requestTimeoutMs = LEONARDO_REQUEST_TIMEOUT_MS,
  pollIntervalMs = LEONARDO_POLL_INTERVAL_MS,
  signal,
  context,
  logger = console,
  development = process.env.NODE_ENV !== 'production',
} = {}) {
  let stage = 'configuration';
  let lastResponse;
  let generationId;
  const prompt = buildHistoricalPrompt(context);
  const workflow = new AbortController();
  const combined = signal ? AbortSignal.any([workflow.signal, signal]) : workflow.signal;
  const deadline = Date.now() + totalTimeoutMs;
  const totalTimer = setTimeout(() => workflow.abort(), totalTimeoutMs);

  async function request(url, options = {}, json = true) {
    lastResponse = undefined;
    const remaining = deadline - Date.now();
    if (combined.aborted || remaining <= 0) throw failure('WORKFLOW_TIMEOUT_OR_CANCELLED');
    const controller = new AbortController();
    const requestSignal = AbortSignal.any([combined, controller.signal]);
    let timer;
    let onAbort;
    try {
      return await Promise.race([
        (async () => {
          const response = await fetchImpl(url, { ...options, signal: requestSignal, redirect: 'error' });
          if (!response.ok) {
            const error = failure('PROVIDER_HTTP_ERROR', response.status);
            error.providerBody = typeof response.text === 'function' ? await response.text() : await response.json();
            throw error;
          }
          if (!json) return;
          lastResponse = await response.json();
          return lastResponse;
        })(),
        new Promise((_, reject) => {
          onAbort = () => reject(failure('WORKFLOW_TIMEOUT_OR_CANCELLED'));
          combined.addEventListener('abort', onAbort, { once: true });
          timer = setTimeout(() => { controller.abort(); reject(failure('REQUEST_TIMEOUT')); }, Math.min(requestTimeoutMs, remaining));
        }),
      ]);
    } finally {
      clearTimeout(timer);
      combined.removeEventListener('abort', onAbort);
    }
  }
  const apiRequest = (endpoint, body) => request(`${LEONARDO_API_BASE}${endpoint}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  try {
    if (!apiKey?.trim()) throw failure('MISSING_API_KEY');
    stage = 'init-image';
    const init = await apiRequest('/v1/init-image', { extension: file.mimetype === 'image/png' ? 'png' : 'jpg' });
    const slot = init?.uploadInitImage;
    if (!slot || typeof slot.id !== 'string' || !slot.id || !slot.fields || typeof slot.url !== 'string') throw failure('MALFORMED_UPLOAD_SLOT');
    const uploadUrl = httpsUrl(slot.url);
    if (!uploadUrl.hostname.endsWith('.amazonaws.com') && !uploadUrl.hostname.endsWith('.amazonaws.com.cn')) throw failure('INVALID_UPLOAD_HOST');
    const fields = typeof slot.fields === 'string' ? JSON.parse(slot.fields) : slot.fields;
    if (!fields || typeof fields !== 'object' || Array.isArray(fields) || !Object.keys(fields).length) throw failure('MALFORMED_UPLOAD_FIELDS');
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      if (typeof value !== 'string' || key === 'file') throw failure('MALFORMED_UPLOAD_FIELDS');
      form.append(key, value);
    }
    form.append('file', new Blob([file.buffer], { type: file.mimetype }), file.mimetype === 'image/png' ? 'reference.png' : 'reference.jpg');
    stage = 'presigned-upload';
    // No Leonardo Authorization or manual Content-Type on the S3 multipart POST.
    await request(uploadUrl.href, { method: 'POST', body: form }, false);

    stage = 'generation';
    const scale = Math.min(1, 1024 / Math.max(file.width, file.height));
    const dimension = (value) => Math.max(32, Math.min(2048, Math.round(value * scale / 32) * 32));
    const generated = await apiRequest('/v2/generations', {
      model: LEONARDO_MODEL,
      public: false,
      parameters: {
        prompt,
        prompt_enhance: 'OFF',
        style_ids: [NO_STYLE_ID],
        width: dimension(file.width),
        height: dimension(file.height),
        quantity: 1,
        guidances: { image_reference: [{ image: { id: slot.id, type: 'UPLOADED' }, strength: LEONARDO_REFERENCE_STRENGTH }] },
      },
    });
    // Current v2 response is generationId; support the earlier generate envelope.
    generationId = generated?.generationId || generated?.generate?.generationId;
    if (typeof generationId !== 'string' || !generationId) throw failure('MALFORMED_GENERATION_RESPONSE');
    stage = 'poll';
    while (!combined.aborted && Date.now() < deadline) {
      const result = await apiRequest(`/v1/generations/${encodeURIComponent(generationId)}`);
      const generation = result?.generations_by_pk;
      if (!generation || typeof generation.status !== 'string') throw failure('MALFORMED_STATUS_RESPONSE');
      if (generation.status === 'FAILED') throw failure('GENERATION_FAILED');
      if (generation.status === 'COMPLETE') {
        const imageUrl = generation.generated_images?.[0]?.url;
        if (typeof imageUrl !== 'string' || !imageUrl) throw failure('MISSING_RESULT_IMAGE');
        httpsUrl(imageUrl);
        return { imageUrl };
      }
      if (!['PENDING', 'PROCESSING', 'IN_PROGRESS', 'QUEUED'].includes(generation.status)) throw failure('UNEXPECTED_GENERATION_STATUS');
      await sleep(Math.min(pollIntervalMs, Math.max(1, deadline - Date.now())), undefined, { signal: combined });
    }
    throw failure('WORKFLOW_TIMEOUT_OR_CANCELLED');
  } catch (error) {
    const code = error.code || 'NETWORK_OR_RESPONSE_ERROR';
    const diagnostic = { stage, code, ...(generationId ? { generationId } : {}), ...(error.status ? { providerStatus: error.status } : {}) };
    if (development) {
      // Preserve provider diagnostics on the server, with credentials redacted.
      const redact = (value) => {
        let text = typeof value === 'string' ? value : JSON.stringify(value);
        if (!text) return text;
        if (apiKey) text = text.split(apiKey).join('[REDACTED]');
        return text.replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]');
      };
      diagnostic.message = redact(error.message);
      diagnostic.providerResponse = redact(error.providerBody ?? lastResponse);
    }
    logger.warn('Leonardo Time Machine failed', diagnostic);
    const timedOut = code === 'REQUEST_TIMEOUT' || code === 'WORKFLOW_TIMEOUT_OR_CANCELLED' || combined.aborted;
    const message = timedOut ? 'Historical reconstruction timed out. Please try again.' : 'Historical reconstruction could not be generated. Please try again.';
    throw Object.assign(new Error(message), { status: timedOut ? 504 : code === 'MISSING_API_KEY' ? 503 : 502, code, step: stage });
  } finally {
    clearTimeout(totalTimer);
    workflow.abort();
  }
}
