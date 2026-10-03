export function errorHandler(error, _req, res, _next) {
  console.error(error.message);
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status <= 599 ? error.status : 500;
  res.status(status).json({ error: status === 500 ? 'Something went wrong. Please try again.' : error.message });
}
