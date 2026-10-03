import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import CiceroniMascot from '../components/CiceroniMascot';
import { buildChatHistory, CICERONI_ERROR } from '../utils/chat';

export default function Ciceroni() {
  const [params, setParams] = useSearchParams();
  const [monumentId, setMonumentId] = useState(params.get('monumentId') || params.get('monument') || '');
  const [monuments, setMonuments] = useState([]);
  const [catalogError, setCatalogError] = useState(false);
  const [language, setLanguage] = useState('en');
  const [opened, setOpened] = useState(Boolean(monumentId));
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState([]);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(null);
  const [error, setError] = useState('');
  const input = useRef(null);
  const end = useRef(null);
  const request = useRef(null);
  const busy = useRef(false);
  const alive = useRef(false);

  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    api.get('/chat/monuments', { signal: controller.signal }).then(({ data }) => { if (alive.current) setMonuments(data); }).catch(() => { if (!controller.signal.aborted) setCatalogError(true); });
    return () => { alive.current = false; controller.abort(); request.current?.abort(); };
  }, []);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [messages, pending, error]);
  useEffect(() => { if (opened) input.current?.focus(); }, [opened]);

  async function send(retry = false) {
    if (busy.current || (failed && !retry)) return;
    const question = retry ? failed?.message : draft.trim();
    if (!question || question.length > 2000) return;
    const payload = retry ? failed.payload : { message: question, language, ...(monumentId ? { monumentId } : {}), history: buildChatHistory(messages) };
    const id = retry ? failed.id : crypto.randomUUID();
    if (!retry) { setMessages((previous) => [...previous, { id, role: 'user', content: question }]); setDraft(''); }
    setFailed(null); setError(''); setPending(true); busy.current = true;
    const controller = new AbortController(); request.current = controller;
    try {
      const { data } = await api.post('/chat', payload, { signal: controller.signal });
      if (!alive.current || controller.signal.aborted) return;
      if (typeof data.answer !== 'string' || !data.answer.trim() || !Array.isArray(data.sources)) throw new Error('Invalid chat response');
      setMessages((previous) => [...previous, { id: crypto.randomUUID(), role: 'assistant', content: data.answer, sources: data.sources }]);
    } catch {
      if (alive.current && !controller.signal.aborted) { setFailed({ id, message: question, payload }); setError(CICERONI_ERROR); }
    } finally {
      if (alive.current) { setPending(false); input.current?.focus(); }
      busy.current = false; request.current = null;
    }
  }
  function selectMonument(value) {
    setMonumentId(value);
    const next = new URLSearchParams(params);
    next.delete('monument');
    if (value) next.set('monumentId', value); else next.delete('monumentId');
    setParams(next, { replace: true });
  }
  const selected = monuments.find((monument) => String(monument.id) === monumentId);
  return <div className="page-shell py-12 sm:py-20">
    <header className="mb-10"><p className="eyebrow">Your companion through history</p><h1 className="section-title">Meet Ciceroni</h1><p className="body-copy mt-5 max-w-2xl">A little curiosity opens a world of stories. Ask your heritage guide about Kosovo’s places, people and architecture.</p></header>
    <div className="grid items-start gap-8 lg:grid-cols-[0.7fr_1.3fr]">
      <aside className="form-card text-center"><CiceroniMascot /><h2 className="mt-3 text-3xl">Hello, explorer.</h2><p className="body-copy mt-4 text-sm">Let’s uncover the stories behind the stones, one question at a time.</p><button type="button" className="btn-primary mt-6" onClick={() => { setOpened(true); input.current?.focus(); }}>Talk to me</button><p className="mt-6 text-xs leading-6 text-heritage-dark/60">Historical interpretations can be uncertain. Check the sources beneath my answers.</p></aside>
      <section className="form-card min-w-0" aria-label="Chat with Ciceroni">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-heritage-tan pb-5"><div><h2 className="text-2xl">A conversation with Ciceroni</h2><p className="mt-2 text-xs text-heritage-dark/60">{selected ? `Exploring ${selected.name_en}` : 'Explore Kosovo’s cultural heritage'}</p></div><label className="text-sm">Language<select className="ml-2 rounded-lg border border-heritage-tan bg-white p-2" disabled={pending || Boolean(failed)} value={language} onChange={(event) => setLanguage(event.target.value)}><option value="en">English</option><option value="sq">Shqip</option></select></label></div>
        <label className="mt-5 block text-sm">Monument context<select className="form-input mt-2" value={monumentId} disabled={pending || Boolean(failed)} onChange={(event) => selectMonument(event.target.value)}><option value="">Match a monument from my question</option>{monumentId && !selected && <option value={monumentId}>Selected monument ({monumentId})</option>}{monuments.map((monument) => <option key={monument.id} value={monument.id}>{monument.name_en}</option>)}</select></label>
        {catalogError && <p role="status" className="mt-3 text-xs">The monument list could not be loaded. You can still name a monument in your question.</p>}
        {opened ? <>
          <div className="mt-6 max-h-[30rem] min-h-56 space-y-4 overflow-y-auto py-2" role="log" aria-label="Conversation" aria-live="polite">
            {!messages.length && <p className="py-8 text-center text-sm text-heritage-dark/60">What would you like to discover? Try asking about Ulpiana or the Stone Bridge in Prizren.</p>}
            {messages.map((message) => <article key={message.id} className={`max-w-[95%] rounded-2xl p-4 ${message.role === 'user' ? 'ml-auto bg-heritage-yellow/25' : 'mr-auto border border-heritage-tan bg-heritage-bg'}`}><p className="mb-2 text-xs font-semibold">{message.role === 'user' ? 'You' : 'Ciceroni'}</p><p className="whitespace-pre-wrap break-words text-sm leading-7">{message.content}</p>{message.sources?.length > 0 && <ul className="mt-4 space-y-2 border-t border-heritage-tan pt-3">{message.sources.map((source) => <li key={source.id}><a href={source.url} target="_blank" rel="noopener noreferrer" className="break-words text-xs underline">[{source.id}] {source.title}</a></li>)}</ul>}</article>)}
            {pending && <p role="status" className="py-3 text-sm text-heritage-dark/70">Ciceroni is thinking…</p>}
            <div ref={end} />
          </div>
          {error && <div role="alert" className="notice-error mt-4"><p>{error}</p><button type="button" className="mt-3 rounded-full border border-red-300 px-4 py-2 font-semibold" disabled={pending} onClick={() => send(true)}>Retry</button></div>}
          <form className="mt-6" onSubmit={(event) => { event.preventDefault(); send(); }}><label htmlFor="ciceroni-message" className="sr-only">Your question for Ciceroni</label><textarea id="ciceroni-message" ref={input} value={draft} maxLength={2000} rows={3} disabled={pending || Boolean(failed)} className="form-input resize-y" placeholder="Ask about a monument, a historical period, or a detail that caught your eye…" onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }} /><div className="mt-3 flex items-center justify-between gap-3"><p className="text-xs text-heritage-dark/60">Enter to send · Shift+Enter for a new line</p><button className="btn-primary" disabled={pending || Boolean(failed) || !draft.trim()}>Send</button></div></form>
        </> : <div className="py-16 text-center"><p className="font-serif text-2xl">There’s a story waiting for you.</p><p className="body-copy mt-4 text-sm">Click “Talk to me” to begin.</p></div>}
      </section>
    </div>
  </div>;
}
