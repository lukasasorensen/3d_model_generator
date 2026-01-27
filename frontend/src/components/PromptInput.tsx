import { useState } from 'react';

interface PromptInputProps {
  onSubmit: (prompt: string) => void;
  loading: boolean;
  isFollowUp?: boolean;
  compact?: boolean;
}

export function PromptInput({ onSubmit, loading, isFollowUp = false, compact = false }: PromptInputProps) {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onSubmit(prompt);
      setPrompt('');
    }
  };

  const newModelExamples = [
    'Create a cube with 20mm sides',
    'Make a sphere with radius 15mm',
    'Design a cylinder 30mm tall and 10mm in diameter',
    'Create a pyramid with a square base'
  ];

  const followUpExamples = [
    'Make it twice as large',
    'Add a hole through the center',
    'Round the edges',
    'Add a base underneath'
  ];

  const examples = isFollowUp ? followUpExamples : newModelExamples;

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              isFollowUp
                ? 'Describe how you want to modify the model...'
                : 'Describe the 3D model you want to create...'
            }
            className={`w-full border border-slate-300 rounded-lg resize-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white ${
              compact ? 'p-3 text-sm' : 'p-4'
            }`}
            rows={compact ? 1 : 3}
            disabled={loading}
          />
        </div>
        <button
          type="submit"
          disabled={loading || !prompt.trim()}
          className={`bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors font-medium ${
            compact ? 'px-4 py-2 text-sm' : 'px-6 py-3'
          }`}
        >
          {loading ? 'Generating...' : isFollowUp ? 'Update Model' : 'Generate 3D Model'}
        </button>
      </form>

      {!compact && (
        <div className="mt-4">
          <p className="text-sm text-slate-600 mb-2">
            {isFollowUp ? 'Modification ideas:' : 'Example prompts:'}
          </p>
          <div className="flex flex-wrap gap-2">
            {examples.map((example, index) => (
              <button
                key={index}
                onClick={() => setPrompt(example)}
                disabled={loading}
                className="px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
