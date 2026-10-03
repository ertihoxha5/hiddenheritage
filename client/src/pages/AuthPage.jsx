import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import FormField from '../components/FormField';
import { apiError, validateForm } from '../utils/validation';

export default function AuthPage({ signup = false }) {
  const { user, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [values, setValues] = useState({ full_name: '', email: '', password: '', confirmPassword: '', role: 'tourist' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(location.state?.toast || '');
  useEffect(() => {
    if (location.state?.toast) navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);
  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(''), 6000); return () => clearTimeout(timer); } }, [toast]);
  function change(event) { setValues({ ...values, [event.target.name]: event.target.value }); setErrors({ ...errors, [event.target.name]: '' }); setError(''); }
  async function submit(event) {
    event.preventDefault(); if (busy) return;
    const next = validateForm(values, signup ? 'signup' : 'login'); setErrors(next); setError('');
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      if (signup) {
        await api.post('/auth/register', { full_name: values.full_name.trim(), email: values.email.trim(), password: values.password, role: values.role });
        navigate('/login', { replace: true, state: { toast: 'Account created, please log in' } });
      } else { await login({ email: values.email.trim(), password: values.password }); navigate('/map', { replace: true }); }
    } catch (requestError) { setError(apiError(requestError)); }
    finally { setBusy(false); }
  }
  if (user) return <Navigate to="/map" replace />;
  return <div className="page-shell grid items-start gap-12 py-14 sm:py-20 lg:grid-cols-2">
    {toast && <div role="status" className="fixed left-4 right-4 top-24 z-[60] mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl border border-heritage-tan bg-white p-4 text-sm shadow-lg">{toast}<button type="button" aria-label="Dismiss notification" onClick={() => setToast('')}>×</button></div>}
    <div><p className="eyebrow">Your next discovery starts here</p><h1 className="section-title">{signup ? 'A little curiosity. A whole new journey.' : 'Welcome back, explorer.'}</h1><p className="body-copy mt-6 max-w-md">{signup ? 'Join travellers, educators, and storytellers discovering Kosovo together.' : 'Step back into the stories, places, and heritage waiting to be discovered.'}</p><div className="mt-8 hidden border-l-2 border-heritage-yellow pl-5 font-serif text-xl text-heritage-dark/60 lg:block">Every stone has a story.</div></div>
    <form noValidate onSubmit={submit} className="form-card space-y-5" aria-label={signup ? 'Create account' : 'Login'}>
      <h2 className="mb-1 text-2xl">{signup ? 'Create your account' : 'Log in to your account'}</h2>
      {signup && <FormField label="Full name" name="full_name" value={values.full_name} onChange={change} error={errors.full_name} autoComplete="name" required maxLength={150} />}
      <FormField label="Email" name="email" type="email" value={values.email} onChange={change} error={errors.email} autoComplete="email" required maxLength={254} />
      <FormField label="Password" name="password" type="password" value={values.password} onChange={change} error={errors.password} autoComplete={signup ? 'new-password' : 'current-password'} required />
      {signup && <><p className="!mt-2 text-xs text-heritage-dark/60">At least 8 characters. Up to 72 UTF-8 bytes.</p><FormField label="Confirm password" name="confirmPassword" type="password" value={values.confirmPassword} onChange={change} error={errors.confirmPassword} autoComplete="new-password" required /><FormField label="I am a…" name="role" value={values.role} onChange={change} error={errors.role}>{['tourist', 'teacher', 'guide'].map((role) => <option key={role} value={role}>{role[0].toUpperCase() + role.slice(1)}</option>)}</FormField></>}
      {error && <p role="alert" className="notice-error">{error}</p>}
      <button disabled={busy} className="btn-primary w-full py-3.5">{busy ? (signup ? 'Creating account…' : 'Logging in…') : (signup ? 'Create account' : 'Login')}</button>
      <p className="text-center text-sm text-heritage-dark/60">{signup ? 'Already part of the journey? ' : 'New to Hidden Heritage? '}<Link className="font-semibold text-heritage-dark underline underline-offset-4" to={signup ? '/login' : '/signup'}>{signup ? 'Log in' : 'Create an account'}</Link></p>
    </form>
  </div>;
}
