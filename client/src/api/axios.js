import axios from 'axios';

export function createAuthClient(baseURL, adapter) {
  const options = { baseURL, withCredentials: true, timeout: 25000, ...(adapter ? { adapter } : {}) };
  const api = axios.create(options);
  const authApi = axios.create(options);
  let session = { user: null, accessToken: null };
  let pendingRefresh = null;
  let generation = 0;
  const listeners = new Set();
  function publish(next, expired = false) {
    session = next;
    listeners.forEach((listener) => listener(next, expired));
  }
  function clear(expired = false) { generation++; publish({ user: null, accessToken: null }, expired); }
  function refresh() {
    if (!pendingRefresh) {
      const version = generation;
      pendingRefresh = authApi.post('/auth/refresh').then(({ data }) => {
        if (version !== generation) throw new Error('Session changed');
        publish({ user: data.user, accessToken: data.accessToken });
        return data;
      }).finally(() => { pendingRefresh = null; });
    }
    return pendingRefresh;
  }
  api.interceptors.request.use((config) => {
    config._authGeneration = generation;
    if (session.accessToken) config.headers.set('Authorization', `Bearer ${session.accessToken}`);
    else config.headers.delete('Authorization');
    return config;
  });
  api.interceptors.response.use((response) => response, async (error) => {
    const config = error.config;
    if (error.response?.status !== 401 || !config || /^\/auth\/(login|register|refresh|logout)/.test(config.url)) throw error;
    if (config._authGeneration !== generation) throw error;
    if (config._retry) { clear(true); throw error; }
    config._retry = true;
    try {
      // Reuse a newer token if another response already triggered rotation.
      if (!session.accessToken || config.headers.get('Authorization') === `Bearer ${session.accessToken}`) await refresh();
    } catch (refreshError) { clear(true); throw refreshError; }
    if (config._authGeneration !== generation) throw error;
    return api(config);
  });
  return {
    api, refresh, getSession: () => session,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    async login(credentials) {
      if (pendingRefresh) await pendingRefresh.catch(() => {});
      const { data } = await authApi.post('/auth/login', credentials);
      generation++; publish({ user: data.user, accessToken: data.accessToken });
      return data.user;
    },
    async logout() {
      clear();
      // Revoke the latest cookie after any in-flight rotation completes.
      if (pendingRefresh) await pendingRefresh.catch(() => {});
      await authApi.post('/auth/logout');
    },
  };
}
export const authClient = createAuthClient(import.meta.env?.VITE_API_URL || 'http://localhost:5000/api');
export default authClient.api;
