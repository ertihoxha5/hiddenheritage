import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { createChatController } from '../controllers/chatController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { CHAT_ERROR } from '../services/groqService.js';

export function createChatRoutes(db, generate) {
  const router = Router();
  const controller = createChatController(db, generate);
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.get('/monuments', asyncHandler(controller.list));
  router.post('/', rateLimit({ windowMs: 60000, limit: 10, keyGenerator: (req) => String(req.user.id), standardHeaders: 'draft-7', legacyHeaders: false, message: { error: CHAT_ERROR } }), asyncHandler(controller.chat));
  return router;
}
