import { Link, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';

function Page({ title, children }) {
  return <section className="mx-auto w-full max-w-6xl px-6 py-16"><h1 className="mb-6 text-4xl md:text-5xl">{title}</h1><div className="max-w-2xl leading-relaxed text-heritage-dark/75">{children}</div></section>;
}

function Home() {
  return <section className="mx-auto w-full max-w-6xl px-6 py-20 md:py-28">
    <p className="mb-5 text-sm font-semibold uppercase tracking-[0.2em]">Kosovo · Stories across centuries</p>
    <h1 className="max-w-3xl text-5xl leading-tight md:text-7xl">Every stone has<br />a story to tell.</h1>
    <p className="mb-9 mt-7 max-w-xl text-lg leading-relaxed text-heritage-dark/70">Discover Kosovo’s castles, bridges, and sacred places. Journey into their past and explore the stories that connect us.</p>
    <Link to="/map" className="inline-block rounded-full bg-heritage-yellow px-7 py-3.5 font-semibold">Explore the map →</Link>
    <div className="mt-16 grid gap-5 md:grid-cols-3">{[
      ['Explore', 'Find monuments and local history on an interactive map.'],
      ['Travel through time', 'Compare today’s landmarks with imagined reconstructions.'],
      ['Meet Ciceroni', 'Discover the stories behind each place with an AI guide.'],
    ].map(([title, description]) => <article key={title} className="rounded-2xl border border-heritage-tan bg-white/40 p-7"><h2 className="mb-3 text-2xl">{title}</h2><p className="text-sm leading-relaxed text-heritage-dark/70">{description}</p></article>)}</div>
  </section>;
}

export default function App() {
  return <div className="flex min-h-screen flex-col"><Navbar /><main className="flex flex-1">
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<Page title="Our heritage, rediscovered"><p>Hidden Heritage brings Kosovo’s historical monuments closer to tourists, teachers, and guides through maps, storytelling, and AI reconstructions.</p><p className="mt-4">AI reconstructions are illustrative interpretations, not verified historical photographs.</p></Page>} />
      <Route path="/contact" element={<Page title="Get in touch"><p>The contact form will be connected in the next phase.</p></Page>} />
      <Route path="/login" element={<Page title="Welcome back"><p>Sign-in is coming in the authentication phase. Protected pages require a session.</p><Link to="/signup" className="mt-5 inline-block underline">Create an account</Link></Page>} />
      <Route path="/signup" element={<Page title="Start your journey"><p>Account registration is coming in the authentication phase.</p><Link to="/login" className="mt-5 inline-block underline">Back to login</Link></Page>} />
      <Route element={<ProtectedRoute />}>
        <Route path="/map" element={<Page title="Explore Kosovo"><p>The monument map will be connected in the next phase.</p></Page>} />
        <Route path="/time-machine" element={<Page title="Time Machine"><p>Photo uploads and AI reconstruction will be connected in the next phase.</p></Page>} />
        <Route path="/ciceroni" element={<Page title="Meet Ciceroni"><p>Your AI heritage guide will be connected in the next phase.</p></Page>} />
      </Route>
      <Route path="*" element={<Page title="Page not found"><Link to="/" className="underline">Return home</Link></Page>} />
    </Routes>
  </main><Footer /></div>;
}
