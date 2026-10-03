export function validateForm(values, kind) {
  const errors = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()) || values.email.trim().length > 254) errors.email = 'Enter a valid email address.';
  if (kind === 'contact') {
    if (!values.name.trim() || values.name.trim().length > 150) errors.name = 'Enter your name (up to 150 characters).';
    if (!values.message.trim() || values.message.trim().length > 10000) errors.message = 'Enter a message (up to 10,000 characters).';
  } else {
    if (values.password.length < 8) errors.password = 'Use at least 8 characters.';
    else if (new TextEncoder().encode(values.password).length > 72) errors.password = 'Use a shorter password (up to 72 UTF-8 bytes).';
    if (kind === 'signup') {
      if (!values.full_name.trim() || values.full_name.trim().length > 150) errors.full_name = 'Enter your full name (up to 150 characters).';
      if (values.password !== values.confirmPassword) errors.confirmPassword = 'Passwords do not match.';
      if (!['tourist', 'teacher', 'guide'].includes(values.role)) errors.role = 'Choose a role.';
    }
  }
  return errors;
}
export const apiError = (error) => error.response?.data?.error || (error.code === 'ECONNABORTED' ? 'The request took too long. Please try again.' : 'Unable to connect. Please try again in a moment.');
