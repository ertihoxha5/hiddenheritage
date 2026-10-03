import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Reveal from '../components/Reveal';
import Icon from '../components/Icon';

const features = [
  ['map', 'Interactive heritage map', 'Find remarkable places across Kosovo. Follow the map to the stories behind them.'],
  ['layers', 'Then & Now', 'See landmarks beside AI reconstructions. Imagine the places as they once stood.'],
  ['clock', 'Time Machine', 'Bring your own photo on the journey. See an imagined version from 100 years ago.'],
  ['chat', 'Ciceroni, your AI guide', 'Ask questions and follow your curiosity. Let Ciceroni bring local history to life.'],
];
export default function Home() {
  const { user } = useAuth();
  return <>
    <section className="relative isolate flex min-h-[100svh] items-center overflow-hidden bg-heritage-dark bg-cover bg-center" style={{ backgroundImage: 'url(/hero.jpg)' }}>
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-black/90 via-black/60 to-black/20" />
      <div className="page-shell py-24">
        <p className="mb-6 text-xs font-semibold uppercase tracking-[0.25em] text-heritage-yellow">Kosovo · A journey through time</p>
        <h1 className="max-w-2xl text-5xl leading-[1.1] text-heritage-bg sm:text-6xl lg:text-7xl">Every stone has a story. Discover Kosovo&apos;s hidden heritage.</h1>
        <p className="mb-9 mt-7 text-base text-white/80 sm:text-lg">Explore the places, people, and stories that shaped Kosovo.</p>
        <Link to={user ? '/map' : '/login'} className="btn-primary inline-flex gap-5 px-7 py-4">Explore Now <span aria-hidden="true">↗</span></Link>
      </div>
      <span className="absolute bottom-8 left-6 text-xs uppercase tracking-[0.2em] text-white/60" aria-hidden="true">A past worth discovering</span>
    </section>
    <section className="page-shell py-20 sm:py-24">
      <Reveal><p className="eyebrow">Your journey, your curiosity</p><h2 className="section-title">What you can do</h2></Reveal>
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{features.map(([icon, title, description]) => <Reveal key={title}><article className="h-full rounded-2xl border border-heritage-tan bg-white/60 p-6"><span className="mb-6 inline-flex rounded-xl bg-heritage-yellow/20 p-3"><Icon name={icon} /></span><h3 className="mb-3 text-2xl">{title}</h3><p title={description} className="line-clamp-2 text-sm leading-6 text-heritage-dark/70">{description}</p></article></Reveal>)}</div>
      <Reveal className="mt-14"><div className="flex flex-wrap items-center gap-5 border-t border-heritage-tan pt-8"><h3 className="mr-auto text-2xl">Who it&apos;s for</h3>{['Tourists', 'Teachers', 'Guides'].map((role) => <span key={role} className="rounded-full border border-heritage-tan px-5 py-2 text-sm">{role}</span>)}</div></Reveal>
    </section>
  </>;
}
