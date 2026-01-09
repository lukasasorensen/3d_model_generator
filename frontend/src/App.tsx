import { PromptInput } from "./components/PromptInput";
import { ModelViewer } from "./components/ModelViewer";
import { ErrorDisplay } from "./components/ErrorDisplay";
import { StreamingCodeDisplay } from "./components/StreamingCodeDisplay";
import { ConversationSidebar } from "./components/ConversationSidebar";
import { ConversationView } from "./components/ConversationView";
import { useConversations } from "./hooks/useConversations";

export default function App() {
  const {
    conversations,
    activeConversation,
    loading,
    error,
    streaming,
    fetchConversations,
    loadConversation,
    startNewConversation,
    addMessage,
    deleteConversation,
    clearError,
  } = useConversations();

  const isStreaming = loading && streaming.status !== "idle";
  const hasActiveConversation = !!activeConversation;

  return (
    <div className="flex h-screen bg-slate-100">
      {/* Sidebar */}
      <ConversationSidebar
        conversations={conversations}
        activeConversationId={activeConversation?.id}
        onSelectConversation={loadConversation}
        onNewConversation={startNewConversation}
        onDeleteConversation={deleteConversation}
        onRefresh={fetchConversations}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto py-8 px-6">
          <header className="text-center mb-8">
            <h1 className="text-4xl font-bold text-slate-900 mb-2">
              OpenSCAD AI Model Generator
            </h1>
            <p className="text-slate-600">
              {hasActiveConversation
                ? "Add follow-up prompts to refine your model"
                : "Describe your 3D model and watch AI create it in real-time"}
            </p>
          </header>

          <div className="space-y-6">
            {/* Prompt Input */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <PromptInput
                onSubmit={addMessage}
                loading={loading}
                isFollowUp={hasActiveConversation}
              />
            </div>

            {/* Error Display */}
            {error && <ErrorDisplay message={error} onDismiss={clearError} />}

            {/* Streaming Display */}
            {isStreaming && <StreamingCodeDisplay streaming={streaming} />}

            {/* Conversation View (when completed) */}
            {activeConversation &&
              streaming.status !== "generating" &&
              streaming.status !== "compiling" && (
                <ConversationView conversation={activeConversation} />
              )}

            {/* Empty State */}
            {!hasActiveConversation && !isStreaming && (
              <div className="bg-white rounded-lg shadow-lg p-12 text-center">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-10 w-10 text-emerald-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold text-slate-800 mb-2">
                  Create Your First Model
                </h2>
                <p className="text-slate-600 max-w-md mx-auto">
                  Describe the 3D model you want to create in the text box
                  above. The AI will generate OpenSCAD code and compile it into
                  a downloadable 3D model.
                </p>
              </div>
            )}
          </div>

          <footer className="mt-12 text-center text-slate-500 text-sm">
            <p>Powered by OpenAI GPT and OpenSCAD • Real-time streaming</p>
          </footer>
        </div>
      </div>
    </div>
  );
}
