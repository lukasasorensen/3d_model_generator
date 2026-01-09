import { Conversation, Message } from "../types";
import { ModelViewer } from "./ModelViewer";

interface ConversationViewProps {
  conversation: Conversation;
}

export function ConversationView({ conversation }: ConversationViewProps) {
  // Get the latest assistant message with a model
  const latestModelMessage = [...conversation.messages]
    .reverse()
    .find((msg) => msg.role === "assistant" && msg.modelUrl);

  return (
    <div className="space-y-6">
      {/* Message History */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">
            Conversation History
          </h2>
        </div>
        <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
          {conversation.messages.map((message) => (
            <MessageItem key={message.id} message={message} />
          ))}
        </div>
      </div>

      {/* Latest Model */}
      {latestModelMessage && latestModelMessage.modelUrl && (
        <div className="bg-white rounded-lg shadow-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold text-slate-800">
            Current 3D Model
          </h2>
          <ModelViewer modelUrl={latestModelMessage.modelUrl} />

          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">
              OpenSCAD Code
            </h3>
            <pre className="bg-slate-900 text-emerald-400 p-4 rounded-lg overflow-x-auto text-sm">
              <code>{latestModelMessage.scadCode}</code>
            </pre>
          </div>

          <div className="flex gap-4">
            <a
              href={latestModelMessage.modelUrl}
              download={`model.${latestModelMessage.format || "stl"}`}
              className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
            >
              Download {(latestModelMessage.format || "stl").toUpperCase()}
            </a>
            <button
              onClick={() => {
                if (latestModelMessage.scadCode) {
                  const blob = new Blob([latestModelMessage.scadCode], {
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
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Download .scad
            </button>
          </div>
        </div>
      )}
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
          {message.scadCode && (
            <details className="mt-2">
              <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
                View generated code
              </summary>
              <pre className="mt-2 bg-slate-900 text-emerald-400 p-3 rounded text-xs overflow-x-auto">
                <code>{message.scadCode}</code>
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
