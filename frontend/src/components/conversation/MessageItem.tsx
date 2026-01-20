/**
 * MessageItem Component
 * Displays a single message in the conversation.
 */

import { Message } from "../../types";
import { ModelViewer } from "../ModelViewer";
import { DownloadButtons } from "../shared/DownloadButtons";
import { CodeDisplay } from "../shared/CodeDisplay";
import { formatTime } from "../../utils/dateUtils";

interface MessageItemProps {
  message: Message;
}

export function MessageItem({ message }: MessageItemProps) {
  const isUser = message.role === "user";

  return (
    <div className={`px-6 py-4 ${isUser ? "bg-white" : "bg-slate-50"}`}>
      <div className="flex items-start gap-3">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
            isUser
              ? "bg-blue-100 text-blue-600"
              : "bg-emerald-100 text-emerald-600"
          }`}
        >
          {isUser ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm text-slate-700">
              {isUser ? "You" : "AI Assistant"}
            </span>
            <span className="text-xs text-slate-400">
              {formatTime(message.createdAt)}
            </span>
          </div>
          <p className="text-slate-600 text-sm">{message.content}</p>

          {/* Preview Image (when no model URL) */}
          {message.previewUrl && !message.modelUrl && (
            <div className="mt-4 space-y-3">
              <h4 className="text-xs uppercase tracking-wide text-slate-500">
                Preview
              </h4>
              <img
                src={message.previewUrl}
                alt="Model preview"
                className="w-full rounded-lg border border-slate-200"
              />
            </div>
          )}

          {/* 3D Model Viewer and Downloads */}
          {message.modelUrl && (
            <div className="mt-4 space-y-4">
              <h4 className="text-xs uppercase tracking-wide text-slate-500">
                3D Model
              </h4>
              <ModelViewer modelUrl={message.modelUrl} />
              <DownloadButtons
                modelUrl={message.modelUrl}
                format={message.format}
                scadCode={message.scadCode}
              />
            </div>
          )}

          {/* OpenSCAD Code */}
          {message.scadCode && (
            <CodeDisplay
              code={message.scadCode}
              collapsible={!!message.modelUrl}
            />
          )}
        </div>
      </div>
    </div>
  );
}
