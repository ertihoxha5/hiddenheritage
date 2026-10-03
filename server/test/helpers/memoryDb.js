// Test-only SQL adapter. Route tests still exercise Express, bcrypt, JWTs,
// cookies, validation, and the real controllers over HTTP.
export function createMemoryDb() {
  let state = { users: [], refreshTokens: [], monuments: [], contacts: [] };
  let lock = Promise.resolve();
  const db = {
    get state() { return state; },
    failNextTokenInsert: false,
    async execute(sql, values = []) {
      if (sql.startsWith('INSERT INTO users')) {
        if (state.users.some((user) => user.email === values[1])) throw Object.assign(new Error('Duplicate email'), { code: 'ER_DUP_ENTRY' });
        state.users.push({ id: state.users.length + 1, full_name: values[0], email: values[1], password_hash: values[2], role: values[3] });
        return [{ insertId: state.users.length }];
      }
      if (sql.includes('FROM users WHERE email')) return [state.users.filter((user) => user.email === values[0])];
      if (sql.includes('FROM users WHERE id')) return [state.users.filter((user) => user.id === values[0])];
      if (sql.startsWith('INSERT INTO refresh_tokens')) {
        if (db.failNextTokenInsert) { db.failNextTokenInsert = false; throw new Error('Simulated database failure'); }
        state.refreshTokens.push({ id: state.refreshTokens.length + 1, user_id: values[0], token_hash: values[1], expires_at: values[2], revoked: false });
        return [{ insertId: state.refreshTokens.length }];
      }
      if (sql.includes('FROM refresh_tokens')) return [state.refreshTokens.filter((token) => token.token_hash === values[0])];
      if (sql.startsWith('UPDATE refresh_tokens')) {
        const key = sql.includes('WHERE id') ? 'id' : 'token_hash';
        const rows = state.refreshTokens.filter((token) => token[key] === values[0]);
        rows.forEach((token) => { token.revoked = true; });
        return [{ affectedRows: rows.length }];
      }
      if (sql.startsWith('INSERT INTO contact_messages')) {
        state.contacts.push({ name: values[0], email: values[1], message: values[2] });
        return [{ insertId: state.contacts.length }];
      }
      if (sql.startsWith('SELECT * FROM monuments')) return [state.monuments.filter((monument) => monument.slug === values[0])];
      if (sql.includes('FROM monuments ORDER BY')) {
        return [[...state.monuments].sort((a, b) => a.name_en.localeCompare(b.name_en)).map(({ id, slug, name_en, type, lat, lng }) => ({ id, slug, name_en, type, lat, lng }))];
      }
      throw new Error(`Unimplemented test SQL: ${sql}`);
    },
    async getConnection() {
      let unlock;
      let snapshot;
      return {
        execute: (...args) => db.execute(...args),
        async beginTransaction() {
          const previous = lock;
          lock = new Promise((resolve) => { unlock = resolve; });
          await previous;
          snapshot = structuredClone(state);
        },
        async commit() { snapshot = undefined; unlock(); unlock = undefined; },
        async rollback() { if (snapshot) state = snapshot; unlock?.(); unlock = undefined; },
        release() { unlock?.(); },
      };
    },
  };
  return db;
}
