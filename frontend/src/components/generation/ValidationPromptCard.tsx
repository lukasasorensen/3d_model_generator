/**
 * ValidationPromptCard Component
 * Displays validation issues and provides retry/ignore options.
 */

interface ValidationPromptCardProps {
  reason: string;
  previewUrl?: string;
  onRetry: () => void;
  onIgnore: () => void;
}

export function ValidationPromptCard({ reason, previewUrl, onRetry, onIgnore }: ValidationPromptCardProps) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-amber-800">AI validation found issues with the model</h3>
          <p className="text-sm text-amber-700 mt-1">{reason}</p>
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Validation preview"
              className="mt-3 rounded-lg border border-amber-200"
            />
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onRetry}
            className="px-3 py-2 bg-amber-600 text-white rounded-md text-sm font-medium hover:bg-amber-700"
          >
            Retry with AI
          </button>
          <button
            onClick={onIgnore}
            className="px-3 py-2 bg-white border border-amber-300 text-amber-800 rounded-md text-sm font-medium hover:bg-amber-100"
          >
            Ignore & Build
          </button>
        </div>
      </div>
    </div>
  );
}
