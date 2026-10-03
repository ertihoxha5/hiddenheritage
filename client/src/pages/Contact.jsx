import { useState } from 'react';
import api from '../api/axios';
import FormField from '../components/FormField';
import { apiError, validateForm } from '../utils/validation';
export default function Contact() {
  const [values, setValues] = useState({ name: '', email: '', message: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  function change(event) { setValues({ ...values, [event.target.name]: event.target.value }); setErrors({ ...errors, [event.target.name]: '' }); setStatus(null); }
  async function submit(event) {
    event.preventDefault(); if (busy) return;
    const next = validateForm(values, 'contact'); setErrors(next); setStatus(null);
    if (Object.keys(next).length) return;
    setBusy(true);
    try { await api.post('/contact', { ...values, name: values.name.trim(), email: values.email.trim(), message: values.message.trim() }); setValues({ name: '', email: '', message: '' }); setStatus({ success: true, message: 'Message sent. Thank you for sharing your thoughts with us.' }); }
    catch (error) { setStatus({ success: false, message: apiError(error) }); }
    finally { setBusy(false); }
  }
  return <div className="page-shell grid gap-12 py-16 sm:py-24 md:grid-cols-2">
    <div><p className="eyebrow">Let&apos;s connect</p><h1 className="section-title">Have a story<br />to share?</h1><p className="body-copy mt-6 max-w-md">A question, a classroom idea, or a place we should discover? We&apos;d love to hear from you.</p></div>
    <form noValidate onSubmit={submit} className="form-card space-y-5" aria-label="Contact form">
      <FormField label="Name" name="name" value={values.name} onChange={change} error={errors.name} autoComplete="name" required maxLength={150} />
      <FormField label="Email" name="email" type="email" value={values.email} onChange={change} error={errors.email} autoComplete="email" required maxLength={254} />
      <FormField label="Message" name="message" multiline rows={5} value={values.message} onChange={change} error={errors.message} required maxLength={10000} />
      {status && <p role={status.success ? 'status' : 'alert'} className={status.success ? 'notice-success' : 'notice-error'}>{status.message}</p>}
      <button disabled={busy} className="btn-primary w-full py-3.5">{busy ? 'Sending…' : 'Send message'}</button>
    </form>
  </div>;
}
