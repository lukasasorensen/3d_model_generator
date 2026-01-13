import { RefObject, useEffect, useRef, useState } from "react";
import { Conversation, Message } from "../types";
import { ModelViewer } from "./ModelViewer";
import { StreamingCodeDisplay } from "./StreamingCodeDisplay";
import { StreamingState } from "../hooks/useConversations";

interface ConversationViewProps {
  conversation: Conversation;
  streaming?: StreamingState;
  scrollContainerRef?: RefObject<HTMLDivElement>;
}

export function ConversationView({
  conversation,
  streaming,
  scrollContainerRef,
}: ConversationViewProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [
    autoScroll,
    conversation.messages.length,
    streaming?.streamingCode,
    streaming?.status,
  ]);

  useEffect(() => {
    const container = scrollContainerRef?.current;
    if (!container) {
      return;
    }

    const handleScroll = () => {
      const distanceToBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      setAutoScroll(distanceToBottom <= 24);
    };

    handleScroll();
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [scrollContainerRef]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">
            Conversation History
          </h2>
        </div>
        <div className="divide-y divide-slate-100">
          {conversation.messages.map((message) => (
            <MessageItem key={message.id} message={message} />
          ))}
        </div>
      </div>
      {streaming &&
        (streaming.status === "generating" ||
          streaming.status === "compiling" ||
          streaming.status === "validating") && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <StreamingCodeDisplay streaming={streaming} />
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

function MessageItem({ message }: { message: Message }) {
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
              {new Date(message.createdAt).toLocaleTimeString()}
            </span>
          </div>
          <p className="text-slate-600 text-sm">{message.content}</p>
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
          {message.modelUrl && (
            <div className="mt-4 space-y-4">
              <h4 className="text-xs uppercase tracking-wide text-slate-500">
                3D Model
              </h4>
              <ModelViewer modelUrl={message.modelUrl} />
              <div className="flex gap-3 flex-wrap">
                <a
                  href={message.modelUrl}
                  download={`model.${message.format || "stl"}`}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
                >
                  Download {(message.format || "stl").toUpperCase()}
                </a>
                <button
                  onClick={() => {
                    if (message.scadCode) {
                      const blob = new Blob([message.scadCode], {
                        type: "text/plain",
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "model.scad";
                      a.click();
                      URL.revokeObjectURL(url);
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  Download .scad
                </button>
              </div>
            </div>
          )}
          {message.scadCode && (
            <div className="mt-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <h4 className="text-xs uppercase tracking-wide text-slate-500">
                  OpenSCAD Code
                </h4>
                <button
                  onClick={() => {
                    void navigator.clipboard.writeText(message.scadCode || "");
                  }}
                  className="text-xs text-slate-600 hover:text-slate-800 transition-colors"
                >
                  Copy code
                </button>
              </div>
              {message.modelUrl ? (
                <details>
                  <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
                    View code
                  </summary>
                  <pre className="mt-2 bg-slate-900 text-emerald-400 p-3 rounded text-xs overflow-x-auto max-h-64 overflow-y-auto">
                    <code>{message.scadCode}</code>
                  </pre>
                </details>
              ) : (
                <pre className="bg-slate-900 text-emerald-400 p-3 rounded text-xs overflow-x-auto max-h-64 overflow-y-auto">
                  <code>{message.scadCode}</code>
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
