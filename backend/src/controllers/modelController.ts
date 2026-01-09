import { Request, Response } from 'express';
import { OpenAIService } from '../services/openaiService';
import { OpenSCADService } from '../services/openscadService';
import { FileStorageService } from '../services/fileStorageService';
import { ModelGenerationRequest } from '../../../shared/src/types/model';

export class ModelController {
  constructor(
    private openaiService: OpenAIService,
    private openscadService: OpenSCADService,
    private fileStorage: FileStorageService
  ) {}

  async generateModelStream(req: Request, res: Response): Promise<void> {
    const { prompt, format = 'stl' } = req.body as ModelGenerationRequest;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: 'Prompt is required and must be a non-empty string',
      });
      return;
    }

    if (prompt.length > 1000) {
      res.status(400).json({
        success: false,
        error: 'Prompt is too long (maximum 1000 characters)',
      });
      return;
    }

    if (format !== 'stl' && format !== '3mf') {
      res.status(400).json({
        success: false,
        error: 'Format must be either "stl" or "3mf"',
      });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      let scadCode = '';

      res.write(`data: ${JSON.stringify({ type: 'start', message: 'Generating OpenSCAD code...' })}\n\n`);

      for await (const chunk of this.openaiService.generateOpenSCADCodeStream(prompt)) {
        scadCode += chunk;
        res.write(`data: ${JSON.stringify({ type: 'code_chunk', chunk })}\n\n`);
      }

      res.write(`data: ${JSON.stringify({ type: 'code_complete', code: scadCode })}\n\n`);

      const { id, filePath: scadPath } = await this.fileStorage.saveScadFile(scadCode);

      res.write(`data: ${JSON.stringify({ type: 'compiling', message: 'Compiling with OpenSCAD...' })}\n\n`);

      const outputPath = this.fileStorage.getOutputPath(id, format);

      if (format === 'stl') {
        await this.openscadService.generateSTL(scadPath, outputPath);
      } else {
        await this.openscadService.generate3MF(scadPath, outputPath);
      }

      res.write(`data: ${JSON.stringify({
        type: 'completed',
        data: {
          id,
          prompt,
          scadCode,
          modelUrl: `/api/models/${id}/${format}`,
          format,
          generatedAt: new Date().toISOString(),
          status: 'completed',
        },
      })}\n\n`);

      res.end();
    } catch (error: any) {
      console.error('Error generating model:', error);
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: error.message || 'Failed to generate model',
      })}\n\n`);
      res.end();
    }
  }

  async generateModel(req: Request, res: Response): Promise<void> {
    try {
      const { prompt, format = 'stl' } = req.body as ModelGenerationRequest;

      if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: 'Prompt is required and must be a non-empty string',
        });
        return;
      }

      if (prompt.length > 1000) {
        res.status(400).json({
          success: false,
          error: 'Prompt is too long (maximum 1000 characters)',
        });
        return;
      }

      if (format !== 'stl' && format !== '3mf') {
        res.status(400).json({
          success: false,
          error: 'Format must be either "stl" or "3mf"',
        });
        return;
      }

      const scadCode = await this.openaiService.generateOpenSCADCode(prompt);

      const { id, filePath: scadPath } = await this.fileStorage.saveScadFile(scadCode);

      const outputPath = this.fileStorage.getOutputPath(id, format);

      if (format === 'stl') {
        await this.openscadService.generateSTL(scadPath, outputPath);
      } else {
        await this.openscadService.generate3MF(scadPath, outputPath);
      }

      res.json({
        success: true,
        data: {
          id,
          prompt,
          scadCode,
          modelUrl: `/api/models/${id}/${format}`,
          format,
          generatedAt: new Date().toISOString(),
          status: 'completed',
        },
      });
    } catch (error: any) {
      console.error('Error generating model:', error);

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate model',
      });
    }
  }

  async getModelFile(req: Request, res: Response): Promise<void> {
    try {
      const { id, format } = req.params;

      if (format !== 'stl' && format !== '3mf') {
        res.status(400).json({
          success: false,
          error: 'Format must be either "stl" or "3mf"',
        });
        return;
      }

      const filePath = this.fileStorage.getOutputPath(id, format as 'stl' | '3mf');

      const exists = await this.fileStorage.fileExists(filePath);
      if (!exists) {
        res.status(404).json({
          success: false,
          error: 'Model file not found',
        });
        return;
      }

      res.sendFile(filePath);
    } catch (error: any) {
      console.error('Error retrieving model file:', error);

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve model file',
      });
    }
  }
}
