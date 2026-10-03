import { Router } from 'express';
import { createContactController } from '../controllers/contactController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export function createContactRoutes(db) {
  const router = Router();
  router.post('/', asyncHandler(createContactController(db)));
  return router;
}
