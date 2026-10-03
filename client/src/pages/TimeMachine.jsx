import { useEffect, useRef, useState } from 'react';
import api from '../api/axios';
import Icon from '../components/Icon';
import { apiError } from '../utils/validation';
import { preparePhoto } from '../utils/timeMachineImages';

export default function TimeMachine() {
  const [mode, setMode] = useState('original-era');
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState('');
  const [result, setResult] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [generationError, setGenerationError] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const input = useRef(null);
  const operation = useRef(0);
  const request = useRef(null);
  const busy = useRef(false);
  const previewUrl = useRef('');

  useEffect(() => () => {
    operation.current++;
    request.current?.abort();
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
  }, []);

  function clearResult() {
    setResult(null);
    setDownloadError('');
  }
  async function selectFile(file) {
    if (busy.current || !file) return;
    const version = ++operation.current;
    setPreparing(true); setError(''); setGenerationError(''); clearResult();
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = ''; setPreview(''); setPhoto(null);
    try {
      const prepared = await preparePhoto(file);
      if (version !== operation.current) return;
      previewUrl.current = URL.createObjectURL(prepared);
      setPhoto(prepared); setPreview(previewUrl.current);
    } catch (failure) { if (version === operation.current) setError(failure.message); }
    finally { if (version === operation.current) setPreparing(false); }
  }
  async function generate() {
    if (!photo || preparing || busy.current) return;
    const version = ++operation.current;
    busy.current = true; setGenerating(true); setError(''); setGenerationError(''); clearResult();
    const controller = new AbortController(); request.current = controller;
    const form = new FormData(); form.append('image', photo); form.append('mode', mode);
    try {
      // The existing authenticated client handles bearer tokens and a single 401 retry.
      const { data } = await api.post('/time-machine', form, { timeout: 65000, signal: controller.signal });
      if (version !== operation.current) return;
      if (typeof data.imageUrl !== 'string' || new URL(data.imageUrl).protocol !== 'https:') throw new Error('Invalid Leonardo result');
      setResult({ url: data.imageUrl, context: data.historicalContext });
    } catch (failure) {
      if (version !== operation.current || controller.signal.aborted) return;
      setGenerationError(failure.response ? apiError(failure) : failure.code === 'ECONNABORTED' ? 'Historical reconstruction timed out. Please try again.' : 'Historical reconstruction could not be generated. Please try again.');
    } finally {
      busy.current = false;
      if (version === operation.current) { setGenerating(false); request.current = null; }
    }
  }
  function handleResultError() {
    clearResult();
    setGenerationError('The Leonardo reconstruction could not be displayed. Please try again.');
  }
  async function download() {
    if (!result || downloading) return;
    const version = operation.current;
    setDownloading(true); setDownloadError('');
    let url;
    let extension = 'png';
    try {
      // Download as a blob: cross-origin links often ignore the download attribute.
      const response = await fetch(result.url, { signal: AbortSignal.timeout(20000), credentials: 'omit' });
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) throw new Error('Invalid image');
      extension = blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : 'png';
      url = URL.createObjectURL(blob);
      if (version !== operation.current) { if (url) URL.revokeObjectURL(url); return; }
      const link = document.createElement('a'); link.href = url;
      link.download = `hidden-heritage-reconstruction.${extension}`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { if (version === operation.current) setDownloadError('Download could not start. Open the image below and save it from your browser.'); }
    finally { setDownloading(false); }
  }

  return <div className="page-shell py-14 sm:py-20">
    <header className="mb-10 text-center"><p className="eyebrow">A glimpse into the past</p><h1 className="section-title">{mode === 'original-era' ? 'See this monument in its original era' : 'See what it looked like 100 years ago'}</h1><p className="body-copy mx-auto mt-5 max-w-2xl">{mode === 'original-era' ? 'Upload a photo to explore a hypothetical reconstruction of the complete monument in its original active period.' : 'Explore the site’s condition 100 years ago, which may already have included ruins.'}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3" role="group" aria-label="Reconstruction period">{[['original-era', 'Original-era reconstruction'], ['100-years', '100 years ago']].map(([value, label]) => <button key={value} type="button" aria-pressed={mode === value} disabled={generating || preparing} className={`rounded-full border px-5 py-2 text-sm font-semibold disabled:opacity-50 ${mode === value ? 'border-heritage-yellow bg-heritage-yellow' : 'border-heritage-tan bg-white'}`} onClick={() => { if (mode !== value) { operation.current++; setMode(value); clearResult(); setGenerationError(''); } }}>{label}</button>)}</div>
    </header>
    <div className="grid items-start gap-8 lg:grid-cols-2">
      <section className="form-card" aria-labelledby="upload-heading">
        <h2 id="upload-heading" className="mb-5 text-2xl">Present-day reference</h2>
        <div className={`flex min-h-72 flex-col items-center justify-center rounded-2xl border-2 border-dashed p-5 text-center transition ${dragging ? 'border-heritage-dark bg-heritage-yellow/20' : 'border-heritage-tan bg-heritage-bg'}`} onDragOver={(event) => { event.preventDefault(); if (!generating) setDragging(true); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }} onDrop={(event) => { event.preventDefault(); setDragging(false); if (event.dataTransfer.files.length !== 1) { setError('Drop one image at a time.'); return; } selectFile(event.dataTransfer.files[0]); }}>
          {preview ? <img src={preview} alt="Your uploaded heritage location today" className="mb-5 max-h-80 w-full rounded-lg object-contain" /> : <><span className="mb-4 rounded-full bg-heritage-tan/60 p-4"><Icon name="layers" /></span><p className="font-medium">Drop a photo of a monument here</p><p className="mt-2 text-sm text-heritage-dark/60">PNG, JPG, JPEG, or SVG · Up to 5 MB</p></>}
          <input ref={input} type="file" accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml" className="sr-only" tabIndex={-1} aria-label="Choose a heritage image" disabled={generating} onChange={(event) => { selectFile(event.target.files?.[0]); event.target.value = ''; }} />
          <button type="button" className="mt-5 rounded-full border border-heritage-dark px-5 py-2.5 text-sm font-semibold disabled:opacity-50" disabled={generating || preparing} onClick={() => input.current?.click()}>Upload an image</button>
          {preparing && <p role="status" className="mt-3 text-sm">Preparing your photo…</p>}
        </div>
        {photo && <p className="mt-3 break-all text-xs text-heritage-dark/60">{photo.name} · {(photo.size / 1024 / 1024).toFixed(2)} MB</p>}
        {error && <p role="alert" className="notice-error mt-5">{error}</p>}
        <button type="button" onClick={generate} disabled={!photo || generating || preparing} className="btn-primary mt-6 w-full py-3.5">{generating ? 'Travelling back in time…' : 'Travel back in time'}</button>
      </section>
      <section className="form-card" aria-labelledby="result-heading" aria-busy={generating}>
        <h2 id="result-heading" className="mb-5 text-2xl">{mode === 'original-era' ? 'AI reconstruction — original era' : result?.context?.period ? `AI reconstruction — ${result.context.period}` : 'AI reconstruction — 100 years ago'}</h2>
        {generating ? <div role="status" className="heritage-shimmer flex min-h-80 flex-col items-center justify-center rounded-2xl p-6 text-center"><Icon name="clock" /><p className="mt-5 font-serif text-2xl">Travelling back in time…</p><p className="mt-3 text-sm text-heritage-dark/70">Restoring the scene can take up to a minute.</p></div> : result ? <>
          <img src={result.url} onError={handleResultError} alt="Leonardo AI historical reconstruction of your uploaded heritage location" className="max-h-[32rem] w-full rounded-2xl object-contain" />
          <p className="mt-4 text-sm">Hypothetical historical interpretation. Architectural details may be uncertain.</p>
          <p className="mt-3 text-xs leading-6">Uncertain reconstructed features: {result.context?.uncertainties || 'Features without supplied evidence remain uncertain; the original design cannot be established from the photo alone.'}</p>
          {(result.context?.sources || []).length > 0 && <div className="mt-3 text-sm"><p>Dataset references used for context:</p><ul className="mt-2 list-disc space-y-2 pl-5">{result.context.sources.map((url) => <li key={url}><a className="break-all underline" href={url} target="_blank" rel="noopener noreferrer">{url}</a></li>)}</ul></div>}
          <div className="mt-6 flex flex-wrap gap-3"><button type="button" className="btn-primary" disabled={downloading} onClick={download}>{downloading ? 'Downloading…' : 'Download'}</button><button type="button" onClick={generate} disabled={preparing || generating} className="rounded-full border border-heritage-dark px-5 py-2.5 text-sm font-semibold">Try again</button></div>
          {downloadError && <p role="alert" className="notice-error mt-4">{downloadError} <a href={result.url} target="_blank" rel="noopener noreferrer" className="underline">Open image</a></p>}
        </> : generationError ? <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl bg-heritage-tan/30 p-8 text-center"><p role="alert" className="notice-error">{generationError}</p><button type="button" className="btn-primary mt-5" onClick={generate} disabled={!photo || preparing || generating}>Try again</button></div> : <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl bg-heritage-tan/30 p-8 text-center"><Icon name="clock" /><p className="mt-5 font-serif text-2xl">The past is waiting.</p><p className="body-copy mt-3 max-w-xs text-sm">Your reconstructed image will appear here after you upload a photo and travel back in time.</p></div>}
      </section>
    </div>
    <p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-6 text-heritage-dark/60">AI reconstructions are historical interpretations, not verified photographs. Your image is sent to Leonardo when you generate.</p>
  </div>;
}
