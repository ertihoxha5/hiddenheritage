import bcrypt from 'bcrypt';
import { hashToken } from '../services/tokens.js';
import { loginSchema, registerSchema } from '../services/validation.js';

const userFields = 'id, full_name, email, role';
const publicUser = ({ id, full_name, email, role }) => ({ id, full_name, email, role });
const invalidRefresh = () => Object.assign(new Error('Invalid or expired refresh token'), { status: 401 });

export function createAuthController(db, tokens, production) {
  const cookieOptions = { httpOnly: true, sameSite: 'lax', secure: production, path: '/api/auth' };
  const clearCookie = (res) => res.clearCookie('refreshToken', cookieOptions);

  async function createSession(connection, user) {
    const accessToken = tokens.access(user);
    const refreshToken = tokens.refresh(user);
    const payload = tokens.verifyRefresh(refreshToken);
    await connection.execute(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [user.id, hashToken(refreshToken), new Date(payload.exp * 1000)],
    );
    return { accessToken, refreshToken, user: publicUser(user) };
  }
  function sendSession(res, session) {
    res.cookie('refreshToken', session.refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
    return res.json({ accessToken: session.accessToken, user: session.user });
  }

  return {
    async register(req, res) {
      const input = registerSchema.parse(req.body);
      const passwordHash = await bcrypt.hash(input.password, 10);
      try {
        await db.execute('INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)', [input.full_name, input.email, passwordHash, input.role]);
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'An account with this email already exists' });
        throw error;
      }
      res.status(201).json({ message: 'Account created. Please log in.' });
    },
    async login(req, res) {
      const { email, password } = loginSchema.parse(req.body);
      const [rows] = await db.execute(`SELECT ${userFields}, password_hash FROM users WHERE email = ?`, [email]);
      const user = rows[0];
      if (!user || !await bcrypt.compare(password, user.password_hash)) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      sendSession(res, await createSession(db, user));
    },
    async refresh(req, res) {
      const token = req.cookies.refreshToken;
      let payload;
      try {
        if (!token) throw invalidRefresh();
        payload = tokens.verifyRefresh(token);
      } catch {
        clearCookie(res);
        throw invalidRefresh();
      }
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        // Lock the old token so simultaneous refresh requests cannot both rotate it.
        const [rows] = await connection.execute('SELECT id, user_id, revoked, expires_at FROM refresh_tokens WHERE token_hash = ? FOR UPDATE', [hashToken(token)]);
        const stored = rows[0];
        if (!stored || stored.revoked || new Date(stored.expires_at).getTime() <= Date.now() || stored.user_id !== Number(payload.sub)) throw invalidRefresh();
        const [users] = await connection.execute(`SELECT ${userFields} FROM users WHERE id = ?`, [stored.user_id]);
        if (!users[0]) throw invalidRefresh();
        await connection.execute('UPDATE refresh_tokens SET revoked = TRUE WHERE id = ?', [stored.id]);
        const session = await createSession(connection, users[0]);
        await connection.commit();
        sendSession(res, session);
      } catch (error) {
        await connection.rollback();
        if (error.status === 401) clearCookie(res);
        throw error;
      } finally {
        connection.release();
      }
    },
    async logout(req, res) {
      if (req.cookies.refreshToken) {
        await db.execute('UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = ?', [hashToken(req.cookies.refreshToken)]);
      }
      clearCookie(res);
      res.json({ message: 'Logged out' });
    },
    async me(req, res) {
      const [users] = await db.execute(`SELECT ${userFields} FROM users WHERE id = ?`, [req.user.id]);
      if (!users[0]) return res.status(401).json({ error: 'Unauthorized' });
      res.json(publicUser(users[0]));
    },
  };
}
