import { useState } from 'react';
import { apiClient } from '../api/client';
import { ModelGenerationResponse } from '../types';

export function useModelGeneration() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<ModelGenerationResponse | null>(null);

  const generateModel = async (prompt: string, format: 'stl' | '3mf' = 'stl') => {
    setLoading(true);
    setError(null);
    setModel(null);

    try {
      const result = await apiClient.generateModel({ prompt, format });
      setModel(result);
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to generate model';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => setError(null);
  const clearModel = () => setModel(null);

  return {
    generateModel,
    loading,
    error,
    model,
    clearError,
    clearModel,
  };
}
