import { createHash, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';

export const hashToken = (token) => createHash('sha256').update(token).digest('hex');

export function createTokenService(accessSecret, refreshSecret) {
  if (!accessSecret || !refreshSecret || accessSecret.startsWith('replace-with-') || refreshSecret.startsWith('replace-with-') || accessSecret === refreshSecret) {
    throw new Error('Set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET to different random secrets in server/.env.');
  }
  function verify(token, secret) {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
    if (typeof payload !== 'object' || !/^\d+$/.test(payload.sub) || !Number.isSafeInteger(Number(payload.sub)) || Number(payload.sub) < 1) {
      throw new Error('Invalid token subject');
    }
    return payload;
  }
  return {
    access: (user) => jwt.sign({ role: user.role }, accessSecret, { subject: String(user.id), expiresIn: '15m', algorithm: 'HS256' }),
    refresh: (user) => jwt.sign({}, refreshSecret, { subject: String(user.id), jwtid: randomUUID(), expiresIn: '7d', algorithm: 'HS256' }),
    verifyAccess: (token) => verify(token, accessSecret),
    verifyRefresh: (token) => verify(token, refreshSecret),
  };
}
