import { Router } from 'express';
import { ModelController } from '../controllers/modelController';

export function createModelRoutes(controller: ModelController): Router {
  const router = Router();

  router.post('/stream', (req, res) => controller.generateModelStream(req, res));
  router.get('/:id/:format', (req, res) => controller.getModelFile(req, res));

  return router;
}
