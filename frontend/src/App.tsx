import { useRef } from "react";
import { PromptInput } from "./components/PromptInput";
import { ErrorDisplay } from "./components/ErrorDisplay";
import { ConversationSidebar } from "./components/ConversationSidebar";
import { ConversationView } from "./components/ConversationView";
import { useConversations } from "./hooks/useConversations";

export default function App() {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const {
    conversations,
    activeConversation,
    loading,
    error,
    streaming,
    validationPrompt,
    fetchConversations,
    loadConversation,
    startNewConversation,
    addMessage,
    deleteConversation,
    clearError,
    retryValidation,
    finalizeValidation,
    approvePreview,
    rejectPreview,
  } = useConversations();

  const isStreaming = loading && streaming.status !== "idle";
  const hasActiveConversation = !!activeConversation;
  const showInitialPrompt = !hasActiveConversation && !loading;
  const showFollowUpPrompt = hasActiveConversation || loading;

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
      <div className="flex-1 overflow-y-auto" ref={scrollContainerRef}>
        <div
          className={`max-w-4xl mx-auto py-8 px-6 ${
            showFollowUpPrompt ? "pb-40" : ""
          }`}
        >
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
            {showInitialPrompt && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <PromptInput onSubmit={addMessage} loading={loading} />
              </div>
            )}

            {/* Error Display */}
            {error && <ErrorDisplay message={error} onDismiss={clearError} />}

            {streaming.status === "awaiting_approval" && streaming.previewUrl && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-blue-800 mb-2">
                    Does this model look correct?
                  </h3>
                  <p className="text-sm text-blue-600 mb-4">
                    Review the preview below and let us know if it matches your request.
                  </p>
                  <img
                    src={streaming.previewUrl}
                    alt="Model preview"
                    className="mx-auto rounded-lg border border-blue-200 mb-6 max-w-full"
                  />
                  <div className="flex justify-center gap-4">
                    <button
                      onClick={() => approvePreview()}
                      className="px-6 py-3 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
                    >
                      Yes, looks good!
                    </button>
                    <button
                      onClick={() => rejectPreview("")}
                      className="px-6 py-3 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                    >
                      No, needs changes
                    </button>
                  </div>
                </div>
              </div>
            )}

            {validationPrompt && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-amber-800">
                      AI validation found issues with the model
                    </h3>
                    <p className="text-sm text-amber-700 mt-1">
                      {validationPrompt.reason}
                    </p>
                    {validationPrompt.previewUrl && (
                      <img
                        src={validationPrompt.previewUrl}
                        alt="Validation preview"
                        className="mt-3 rounded-lg border border-amber-200"
                      />
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => retryValidation(validationPrompt.reason)}
                      className="px-3 py-2 bg-amber-600 text-white rounded-md text-sm font-medium hover:bg-amber-700"
                    >
                      Retry with AI
                    </button>
                    <button
                      onClick={() => finalizeValidation()}
                      className="px-3 py-2 bg-white border border-amber-300 text-amber-800 rounded-md text-sm font-medium hover:bg-amber-100"
                    >
                      Ignore & Build
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Conversation View */}
            {activeConversation && (
              <ConversationView
                conversation={activeConversation}
                streaming={streaming}
                scrollContainerRef={scrollContainerRef}
              />
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

          <footer className="mt-12 text-center text-slate-500 text-sm pb-10">
            <p>Created by: Lukas Sorensen | {new Date().getFullYear()} ©</p>
          </footer>
        </div>
      </div>

      {showFollowUpPrompt && (
        <div className="fixed bottom-0 left-72 right-0 z-20 px-6 pb-6">
          <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl border border-slate-200 p-4">
            <PromptInput
              onSubmit={addMessage}
              loading={loading}
              isFollowUp
              compact
            />
          </div>
        </div>
      )}
    </div>
  );
}
