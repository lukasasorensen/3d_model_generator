import { PromptInput } from './components/PromptInput';
import { ModelViewer } from './components/ModelViewer';
import { ErrorDisplay } from './components/ErrorDisplay';
import { StreamingCodeDisplay } from './components/StreamingCodeDisplay';
import { useModelGeneration } from './hooks/useModelGeneration';

export default function App() {
  const { generateModel, loading, error, model, streaming, clearError } = useModelGeneration();

  const isStreaming = loading && streaming.status !== 'idle';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-3">
            OpenSCAD AI Model Generator
          </h1>
          <p className="text-lg text-gray-600">
            Describe your 3D model and watch AI create it in real-time
          </p>
        </header>

        <div className="space-y-8">
          <PromptInput onSubmit={generateModel} loading={loading} />

          {error && <ErrorDisplay message={error} onDismiss={clearError} />}

          {isStreaming && <StreamingCodeDisplay streaming={streaming} />}

          {model && streaming.status === 'completed' && (
            <div className="bg-white rounded-lg shadow-xl p-8 space-y-6">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                  Generated 3D Model
                </h2>
                <p className="text-gray-600 mb-4">
                  <strong>Your prompt:</strong> {model.prompt}
                </p>
                <ModelViewer modelUrl={model.modelUrl} />
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Generated OpenSCAD Code
                </h3>
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto">
                  <code>{model.scadCode}</code>
                </pre>
              </div>

              <div className="flex gap-4">
                <a
                  href={model.modelUrl}
                  download={`model-${model.id}.${model.format}`}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  Download {model.format.toUpperCase()}
                </a>
                <button
                  onClick={() => {
                    const blob = new Blob([model.scadCode], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `model-${model.id}.scad`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Download .scad
                </button>
              </div>
            </div>
          )}
        </div>

        <footer className="mt-16 text-center text-gray-500 text-sm">
          <p>
            Powered by OpenAI GPT-4 and OpenSCAD • Real-time streaming
          </p>
        </footer>
      </div>
    </div>
  );
}
