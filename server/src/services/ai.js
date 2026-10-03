// All future external AI calls must use this server-side helper.
// The timeout covers the request and reading/parsing its response.
export async function requestAI(url, options = {}, fallback = null) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(url, { ...options, signal: controller.signal });
        if (!response.ok) throw new Error(`AI provider returned ${response.status}`);
        return await response.json();
      })(),
      new Promise((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error('AI request timed out')); }, 20000);
      }),
    ]);
  } catch (error) {
    console.warn('AI request failed:', error.name);
    return typeof fallback === 'function' ? fallback() : fallback;
  } finally {
    clearTimeout(timer);
  }
}
