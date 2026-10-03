import { useEffect } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import About from './pages/About';
import Contact from './pages/Contact';
import AuthPage from './pages/AuthPage';
import TimeMachine from './pages/TimeMachine';
import Ciceroni from './pages/Ciceroni';

function Placeholder({ title, children }) {
  return <section className="page-shell py-20"><p className="eyebrow">Your heritage journey</p><h1 className="section-title">{title}</h1><div className="body-copy mt-6 max-w-xl">{children}</div></section>;
}
export default function App() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return <div className="flex min-h-screen flex-col"><a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[70] focus:bg-heritage-yellow focus:p-4">Skip to content</a><Navbar /><main id="main-content" className="flex-1">
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/login" element={<AuthPage key="login" />} />
      <Route path="/signup" element={<AuthPage key="signup" signup />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/map" element={<Placeholder title="Explore Kosovo"><p>You&apos;re logged in. Your monument map dashboard will arrive in the next phase.</p></Placeholder>} />
        <Route path="/time-machine" element={<TimeMachine />} />
        <Route path="/ciceroni" element={<Ciceroni />} />
      </Route>
      <Route path="*" element={<Placeholder title="Page not found"><Link to="/" className="underline">Return home</Link></Placeholder>} />
    </Routes>
  </main><Footer /></div>;
}
