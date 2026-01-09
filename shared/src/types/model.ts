export interface ModelGenerationRequest {
  prompt: string;
  format?: 'stl' | '3mf';
}

export interface ModelGenerationResponse {
  id: string;
  prompt: string;
  scadCode: string;
  modelUrl: string;
  format: 'stl' | '3mf';
  generatedAt: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  error?: string;
}

export interface OpenSCADError {
  message: string;
  line?: number;
  column?: number;
}
