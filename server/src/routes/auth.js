import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { createAuthController } from '../controllers/authController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';

export function createAuthRoutes(db, tokens, production) {
  const router = Router();
  const controller = createAuthController(db, tokens, production);
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  const loginLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many login requests. Please try again in a minute.' },
  });
  router.post('/register', asyncHandler(controller.register));
  router.post('/login', loginLimiter, asyncHandler(controller.login));
  router.post('/refresh', asyncHandler(controller.refresh));
  router.post('/logout', asyncHandler(controller.logout));
  router.get('/me', requireAuth(tokens), asyncHandler(controller.me));
  return router;
}
