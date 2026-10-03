export function requireAuth(tokens) {
  return (req, res, next) => {
    const match = /^Bearer (\S+)$/i.exec(req.get('Authorization') || '');
    if (!match) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const payload = tokens.verifyAccess(match[1]);
      if (!['tourist', 'teacher', 'guide'].includes(payload.role)) throw new Error('Invalid role');
      req.user = { id: Number(payload.sub), role: payload.role };
      next();
    } catch {
      res.status(401).json({ error: 'Unauthorized' });
    }
  };
}
