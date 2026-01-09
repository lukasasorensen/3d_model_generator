import axios from 'axios';
import { ModelGenerationRequest, ModelGenerationResponse, ApiResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

export const apiClient = {
  async generateModel(request: ModelGenerationRequest): Promise<ModelGenerationResponse> {
    const response = await axios.post<ApiResponse<ModelGenerationResponse>>(
      `${API_BASE_URL}/models/generate`,
      request
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to generate model');
    }

    return response.data.data;
  },

  getModelUrl(id: string, format: 'stl' | '3mf'): string {
    return `${API_BASE_URL}/models/${id}/${format}`;
  },
};
