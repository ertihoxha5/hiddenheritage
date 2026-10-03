import { Router } from 'express';
import { timeMachineUpload } from '../middleware/timeMachineUpload.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { createTimeMachineController } from '../controllers/timeMachineController.js';

export function createTimeMachineRoutes(generate) {
  const router = Router();
  router.post('/', timeMachineUpload, asyncHandler(createTimeMachineController(generate)));
  return router;
}
