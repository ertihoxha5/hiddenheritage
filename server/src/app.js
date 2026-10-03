import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pool } from './db.js';
import healthRoutes from './routes/health.js';
import { createAuthRoutes } from './routes/auth.js';
import { createContactRoutes } from './routes/contact.js';
import { createMonumentRoutes } from './routes/monuments.js';
import { createTokenService } from './services/tokens.js';
import { requireAuth } from './middleware/requireAuth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createTimeMachineRoutes } from './routes/timeMachine.js';
import { createChatRoutes } from './routes/chat.js';

export function createApp({ db = pool, accessSecret = process.env.JWT_ACCESS_SECRET, refreshSecret = process.env.JWT_REFRESH_SECRET, production = process.env.NODE_ENV === 'production', timeMachineGenerate, chatGenerate } = {}) {
  const tokens = createTokenService(accessSecret, refreshSecret);
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use('/api', healthRoutes);
  app.use('/api/auth', createAuthRoutes(db, tokens, production));
  app.use('/api/contact', createContactRoutes(db));
  app.use('/api/monuments', requireAuth(tokens), createMonumentRoutes(db));
  app.use('/api/time-machine', requireAuth(tokens), createTimeMachineRoutes(timeMachineGenerate));
  app.use('/api/chat', requireAuth(tokens), createChatRoutes(db, chatGenerate));
  app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
  app.use(errorHandler);
  return app;
}
