import { Router } from 'express';
import { createMonumentController } from '../controllers/monumentController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export function createMonumentRoutes(db) {
  const router = Router();
  const controller = createMonumentController(db);
  router.get('/', asyncHandler(controller.list));
  router.get('/:slug', asyncHandler(controller.detail));
  return router;
}
