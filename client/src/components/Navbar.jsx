import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  async function handleLogout() {
    setBusy(true);
    try { await logout(); }
    catch { setError('Signed out here. The server could not end your saved session. Please retry when connected.'); }
    finally { setBusy(false); setOpen(false); navigate('/login', { replace: true }); }
  }
  const links = user
    ? [['/map', 'Map'], ['/time-machine', 'Time Machine'], ['/ciceroni', 'Ciceroni']]
    : [['/', 'Home'], ['/about', 'About'], ['/contact', 'Contact']];
  return (
    <header className="sticky top-0 z-50 border-b border-heritage-tan bg-heritage-bg/95 backdrop-blur">
      <nav aria-label="Main navigation" className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5 px-6 py-5">
        <Link to="/" onClick={() => setOpen(false)} className="font-serif text-xl font-bold sm:text-2xl">Hidden Heritage<span className="text-heritage-yellow">.</span></Link>
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="nav-links" className="rounded-lg border border-heritage-tan px-3 py-2 text-sm md:hidden">{open ? 'Close' : 'Menu'}</button>
        <div id="nav-links" className={`${open ? 'flex' : 'hidden'} w-full flex-col items-start gap-5 text-sm font-medium md:flex md:w-auto md:flex-row md:items-center md:gap-6`}>
          {links.map(([to, label]) => <NavLink key={to} to={to} onClick={() => setOpen(false)} end={to === '/'} className={({ isActive }) => isActive ? 'underline decoration-heritage-yellow decoration-4 underline-offset-8' : 'hover:underline'}>{label}</NavLink>)}
          {user ? <button disabled={busy} onClick={handleLogout} className="btn-primary">{busy ? 'Signing out…' : 'Logout'}</button> : <Link to="/login" onClick={() => setOpen(false)} className="btn-primary">Login</Link>}
        </div>
      </nav>
      {error && <p role="alert" className="mx-auto max-w-6xl px-6 pb-3 text-sm text-red-800">{error} <button disabled={busy} onClick={() => { setError(''); handleLogout(); }} className="mr-3 underline">Retry</button><button onClick={() => setError('')} className="underline">Dismiss</button></p>}
    </header>
  );
}
