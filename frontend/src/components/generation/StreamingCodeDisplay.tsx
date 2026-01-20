/**
 * StreamingCodeDisplay Component
 * Displays streaming code generation progress.
 */

import { StreamingState } from "../../hooks/useStreamingState";

interface StreamingCodeDisplayProps {
  streaming: StreamingState;
}

export function StreamingCodeDisplay({ streaming }: StreamingCodeDisplayProps) {
  if (streaming.status === "idle") {
    return null;
  }

  const getStatusColor = () => {
    switch (streaming.status) {
      case "generating":
        return "bg-blue-50 border-blue-200";
      case "compiling":
        return "bg-yellow-50 border-yellow-200";
      case "completed":
        return "bg-green-50 border-green-200";
      case "validating":
        return "bg-purple-50 border-purple-200";
      case "error":
        return "bg-red-50 border-red-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  const getStatusIcon = () => {
    switch (streaming.status) {
      case "generating":
        return (
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
        );
      case "compiling":
        return (
          <div className="animate-pulse">
            <svg
              className="h-5 w-5 text-yellow-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9v-2h2v2zm0-4H9V5h2v4z" />
            </svg>
          </div>
        );
      case "completed":
        return (
          <svg
            className="h-5 w-5 text-green-600"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        );
      case "validating":
        return (
          <div className="animate-pulse">
            <svg
              className="h-5 w-5 text-purple-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9v-2h2v2zm0-4H9V5h2v4z" />
            </svg>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={`border rounded-lg p-6 ${getStatusColor()} transition-colors`}
    >
      <div className="flex items-center gap-3 mb-4">
        {getStatusIcon()}
        <h3 className="text-lg font-semibold text-gray-900">
          {streaming.statusMessage}
        </h3>
      </div>

      {streaming.status === "validating" && streaming.previewUrl && (
        <div className="mt-4">
          <img
            src={streaming.previewUrl}
            alt="Model preview"
            className="w-full rounded-lg border border-slate-200"
          />
        </div>
      )}

      {streaming.streamingCode && streaming.status !== "validating" && (
        <div className="mt-4">
          <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
            <pre className="text-green-400 text-sm font-mono">
              <code>{streaming.streamingCode}</code>
              {streaming.status === "generating" && (
                <span className="inline-block w-2 h-4 bg-green-400 animate-pulse ml-1"></span>
              )}
            </pre>
          </div>
        </div>
      )}

      {streaming.streamingReasoning && (
        <div className="mt-4">
          <h4 className="text-xs uppercase tracking-wide text-slate-500 mb-2">
            Reasoning
          </h4>
          <div className="bg-slate-100 text-slate-700 p-3 rounded text-xs whitespace-pre-wrap">
            {streaming.streamingReasoning}
          </div>
        </div>
      )}

      {streaming.status === "compiling" && (
        <div className="mt-4">
          <div className="flex items-center gap-2 text-yellow-700">
            <svg
              className="animate-spin h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span className="text-sm">Processing with OpenSCAD...</span>
          </div>
        </div>
      )}
    </div>
  );
}
