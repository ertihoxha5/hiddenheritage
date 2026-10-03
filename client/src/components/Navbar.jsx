import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const links = user
    ? [['/map', 'Map'], ['/time-machine', 'Time Machine'], ['/ciceroni', 'Ciceroni']]
    : [['/', 'Home'], ['/about', 'About'], ['/contact', 'Contact']];
  return (
    <header className="border-b border-heritage-tan">
      <nav aria-label="Main navigation" className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5 px-6 py-5">
        <Link to="/" className="font-serif text-2xl font-bold">Hidden Heritage<span className="text-heritage-yellow">.</span></Link>
        <div className="flex flex-wrap items-center gap-6 text-sm font-medium">
          {links.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive ? 'underline decoration-heritage-yellow decoration-4 underline-offset-8' : 'hover:underline'}>{label}</NavLink>)}
          {user ? <button onClick={logout} className="rounded-full bg-heritage-yellow px-5 py-2.5">Logout</button> : <Link to="/login" className="rounded-full bg-heritage-yellow px-5 py-2.5">Login</Link>}
        </div>
      </nav>
    </header>
  );
}
