import { useState } from 'react';
import { apiClient, StreamEvent } from '../api/client';
import { ModelGenerationResponse } from '../types';

export interface StreamingState {
  status: 'idle' | 'generating' | 'compiling' | 'completed' | 'error';
  streamingCode: string;
  statusMessage: string;
}

export function useModelGeneration() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<ModelGenerationResponse | null>(null);
  const [streaming, setStreaming] = useState<StreamingState>({
    status: 'idle',
    streamingCode: '',
    statusMessage: '',
  });

  const generateModel = async (prompt: string, format: 'stl' | '3mf' = 'stl') => {
    setLoading(true);
    setError(null);
    setModel(null);
    setStreaming({
      status: 'idle',
      streamingCode: '',
      statusMessage: '',
    });

    try {
      await apiClient.generateModelStream({ prompt, format }, (event: StreamEvent) => {
        switch (event.type) {
          case 'start':
            setStreaming({
              status: 'generating',
              streamingCode: '',
              statusMessage: event.message || 'Starting...',
            });
            break;

          case 'code_chunk':
            setStreaming((prev) => ({
              ...prev,
              streamingCode: prev.streamingCode + (event.chunk || ''),
            }));
            break;

          case 'code_complete':
            setStreaming((prev) => ({
              ...prev,
              streamingCode: event.code || prev.streamingCode,
              statusMessage: 'Code generation complete',
            }));
            break;

          case 'compiling':
            setStreaming((prev) => ({
              ...prev,
              status: 'compiling',
              statusMessage: event.message || 'Compiling...',
            }));
            break;

          case 'completed':
            if (event.data) {
              setModel(event.data);
              setStreaming({
                status: 'completed',
                streamingCode: event.data.scadCode,
                statusMessage: 'Complete!',
              });
            }
            break;

          case 'error':
            throw new Error(event.error || 'Stream error');
        }
      });
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to generate model';
      setError(errorMessage);
      setStreaming((prev) => ({
        ...prev,
        status: 'error',
        statusMessage: errorMessage,
      }));
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => setError(null);
  const clearModel = () => {
    setModel(null);
    setStreaming({
      status: 'idle',
      streamingCode: '',
      statusMessage: '',
    });
  };

  return {
    generateModel,
    loading,
    error,
    model,
    streaming,
    clearError,
    clearModel,
  };
}
