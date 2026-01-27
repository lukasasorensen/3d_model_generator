/**
 * App Component
 * Main application entry point with providers and layout.
 */

import { useRef } from 'react';
import { ConversationProvider, useConversationContext } from './contexts/ConversationContext';
import { GenerationProvider, useGenerationContext } from './contexts/GenerationContext';
import { ConversationSidebar } from './components/conversation/ConversationSidebar';
import { MainContent } from './components/layout/MainContent';
import { PromptInput } from './components/PromptInput';

function AppContent() {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const {
    conversations,
    activeConversation,
    fetchConversations,
    loadConversation,
    startNewConversation,
    deleteConversation
  } = useConversationContext();

  const { loading, addMessage } = useGenerationContext();

  const hasActiveConversation = !!activeConversation;
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
        <MainContent scrollContainerRef={scrollContainerRef} />
      </div>

      {/* Follow-up Prompt */}
      {showFollowUpPrompt && (
        <div className="fixed bottom-0 left-72 right-0 z-20 px-6 pb-6">
          <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl border border-slate-200 p-4">
            <PromptInput onSubmit={addMessage} loading={loading} isFollowUp compact />
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ConversationProvider>
      <GenerationProvider>
        <AppContent />
      </GenerationProvider>
    </ConversationProvider>
  );
}
