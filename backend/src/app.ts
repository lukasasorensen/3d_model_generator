import express from 'express';
import cors from 'cors';
import { createModelRoutes } from './routes/models';
import { errorHandler } from './middleware/errorHandler';
import { OpenAIService } from './services/openaiService';
import { OpenSCADService } from './services/openscadService';
import { FileStorageService } from './services/fileStorageService';
import { ModelController } from './controllers/modelController';
import * as path from 'path';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  const openaiService = new OpenAIService(process.env.OPENAI_API_KEY!);
  const openscadService = new OpenSCADService(path.join(__dirname, '../generated'));
  const fileStorage = new FileStorageService(
    path.join(__dirname, '../generated/scad'),
    path.join(__dirname, '../generated/stl'),
    path.join(__dirname, '../generated/3mf')
  );

  const modelController = new ModelController(openaiService, openscadService, fileStorage);

  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.use('/api/models', createModelRoutes(modelController));

  app.use(errorHandler);

  return { app, fileStorage };
}
