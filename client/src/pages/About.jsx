import Reveal from '../components/Reveal';
export default function About() {
  return <div className="page-shell py-16 sm:py-24">
    <p className="eyebrow">Made for Kosovo</p><h1 className="section-title max-w-3xl">Our past deserves to be part of our future.</h1>
    <div className="mt-10 grid gap-10 md:grid-cols-2">
      <Reveal><h2 className="mb-4 text-3xl">Rich history. Hidden stories.</h2><p className="body-copy">Kosovo&apos;s heritage is rich, but under-presented. Visitors struggle to find the stories behind a monument, while students have few engaging ways to learn about the history around them.</p></Reveal>
      <Reveal><h2 className="mb-4 text-3xl">A new way to discover.</h2><p className="body-copy">Hidden Heritage brings monuments, local stories, and learning together. Tourists can explore, teachers can spark curiosity, and guides can share a deeper view of Kosovo.</p></Reveal>
    </div>
    <Reveal className="my-16"><section className="rounded-3xl bg-heritage-tan/60 p-7 sm:p-10"><p className="eyebrow">History meets imagination</p><h2 className="mb-5 text-3xl">How we use AI</h2><p className="body-copy max-w-3xl">AI helps imagine how monuments may have looked in the past, transforms your photos into historical interpretations, and powers Ciceroni, a conversational heritage guide.</p><p className="mt-5 max-w-3xl text-sm leading-6 text-heritage-dark/70">Reconstructions are illustrative interpretations, not verified historical photographs. Monument histories and sources provide context for exploring responsibly.</p></section></Reveal>
    <Reveal><p className="eyebrow">Five people, one shared curiosity</p><h2 className="section-title">Team</h2></Reveal>
    <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">{['Product & research', 'Frontend development', 'Backend development', 'AI experiences', 'Design & storytelling'].map((role, index) => <Reveal key={role}><article className="rounded-2xl border border-heritage-tan bg-white/60 p-6"><div aria-hidden="true" className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-heritage-tan font-serif text-2xl">0{index + 1}</div><h3 className="text-xl">Team member {index + 1}</h3><p className="mt-2 text-sm text-heritage-dark/60">{role}</p><p className="mt-4 text-xs text-heritage-dark/50">Name coming soon</p></article></Reveal>)}</div>
  </div>;
}
