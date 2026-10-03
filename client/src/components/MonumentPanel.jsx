import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { monumentImageUrl, monumentSources, TYPE_LABELS } from '../utils/map';

function MonumentPhoto({ label, image, credit, reconstruction }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const url = monumentImageUrl(image);
  useEffect(() => { setFailed(false); setLoaded(false); }, [image]);
  return <figure className="mt-6"><figcaption className="mb-3 text-sm font-semibold">{label}</figcaption>
    {url && !failed ? <div className="relative overflow-hidden rounded-2xl bg-heritage-tan/40">{!loaded && <div className="heritage-shimmer absolute inset-0" aria-hidden="true" />}<img src={url} alt={label} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} className="relative aspect-[4/3] w-full object-cover" /></div> : <div className="flex aspect-[4/3] items-center justify-center rounded-2xl border border-dashed border-heritage-tan bg-heritage-bg p-6 text-center text-sm text-heritage-dark/60">{reconstruction ? 'No reconstruction image has been added for this monument yet.' : 'No present-day photo is available yet.'}</div>}
    {credit && <p className="mt-2 text-xs leading-5 text-heritage-dark/60">Photo credit: {credit}</p>}
    {reconstruction && <p className="mt-2 text-xs leading-5 text-heritage-dark/60">AI-generated reconstruction, for illustration</p>}
  </figure>;
}

export default function MonumentPanel({ selected, monument, loading, error, onClose, onRetry }) {
  const close = useRef(null);
  useEffect(() => { close.current?.focus({ preventScroll: true }); }, [selected.slug]);
  const sources = monumentSources(monument?.sources);
  return <aside className="monument-panel" aria-labelledby="monument-title" aria-busy={loading}>
    <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-heritage-tan lg:hidden" aria-hidden="true" />
    <div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="eyebrow mb-2">Hidden stories, living places</p><h2 id="monument-title" className="text-2xl leading-tight">{monument?.name_en || selected.name_en}</h2>{monument?.name_sq && <p className="mt-2 text-sm text-heritage-dark/60">{monument.name_sq}</p>}</div><button ref={close} type="button" onClick={onClose} className="shrink-0 rounded-full border border-heritage-tan px-3 py-2 text-xl leading-none" aria-label="Close monument details">×</button></div>
    {loading ? <div role="status" className="mt-6 space-y-5"><span className="sr-only">Loading monument details…</span><div className="heritage-shimmer h-7 w-2/3 rounded-lg" /><div className="heritage-shimmer aspect-[4/3] rounded-2xl" /><div className="heritage-shimmer aspect-[4/3] rounded-2xl" />{[1, 2, 3].map((line) => <div key={line} className="heritage-shimmer h-4 rounded-lg" />)}</div> : error ? <div role="alert" className="notice-error mt-6"><p>We couldn’t load this monument’s story. Please try again.</p><button type="button" onClick={onRetry} className="mt-4 rounded-full border border-red-300 px-4 py-2 font-semibold">Try again</button></div> : monument && <>
      <div className="mt-5 flex flex-wrap items-center gap-3"><span className="rounded-full bg-heritage-yellow/25 px-3 py-1 text-xs font-semibold">{TYPE_LABELS[monument.type] || 'Monument'}</span>{monument.municipality && <span className="text-xs text-heritage-dark/60">{monument.municipality}</span>}</div>
      {monument.built_period && <p className="mt-3 text-sm leading-6 text-heritage-dark/70">{monument.built_period}</p>}
      <MonumentPhoto label="Today" image={monument.image_now} credit={monument.image_now_credit} />
      <MonumentPhoto label="When it was built — AI reconstruction" image={monument.image_then} reconstruction />
      <section className="mt-8"><h3 className="text-xl">The story of this place</h3><p className="body-copy mt-4 whitespace-pre-line text-sm">{monument.history || monument.short_description || 'A detailed history has not been added yet.'}</p>{monument.reconstruction_note && <p className="mt-4 text-xs leading-6 text-heritage-dark/60">{monument.reconstruction_note}</p>}</section>
      {sources.length > 0 && <section className="mt-6"><h3 className="text-lg">Sources</h3><ul className="mt-3 space-y-3">{sources.map((source, index) => <li key={`${source.url}-${index}`}><a href={source.url} target="_blank" rel="noopener noreferrer" className="break-words text-xs underline underline-offset-4">{source.title}</a></li>)}</ul></section>}
      <Link to={`/ciceroni?monument=${encodeURIComponent(selected.slug)}`} className="btn-primary mt-8 block text-center">Ask Ciceroni about this place</Link>
    </>}
  </aside>;
}
