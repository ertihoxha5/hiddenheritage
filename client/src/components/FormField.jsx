export default function FormField({ label, name, error, multiline = false, children, ...props }) {
  const Tag = multiline ? 'textarea' : children ? 'select' : 'input';
  return <div><label htmlFor={name} className="mb-2 block text-sm font-medium">{label}</label><Tag id={name} name={name} className="form-input" aria-invalid={!!error} aria-describedby={error ? `${name}-error` : undefined} {...props}>{children}</Tag>{error && <p id={`${name}-error`} className="mt-1.5 text-sm text-red-800">{error}</p>}</div>;
}
