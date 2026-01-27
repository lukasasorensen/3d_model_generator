/**
 * MainContent Component
 * Main content area with header and content sections.
 */

import { RefObject } from 'react';
import { PromptInput } from '../PromptInput';
import { ErrorDisplay } from '../shared/ErrorDisplay';
import { PreviewApprovalCard } from '../generation/PreviewApprovalCard';
import { ValidationPromptCard } from '../generation/ValidationPromptCard';
import { EmptyState } from './EmptyState';
import { ConversationView } from '../conversation/ConversationView';
import { useConversationContext } from '../../contexts/ConversationContext';
import { useGenerationContext } from '../../contexts/GenerationContext';

interface MainContentProps {
  scrollContainerRef: RefObject<HTMLDivElement>;
}

export function MainContent({ scrollContainerRef }: MainContentProps) {
  const { activeConversation, activeError, clearError: clearActiveError } = useConversationContext();
  const {
    streaming,
    validationPrompt,
    loading,
    error: generationError,
    addMessage,
    approvePreview,
    rejectPreview,
    retryValidation,
    finalizeValidation,
    clearError: clearGenerationError
  } = useGenerationContext();

  const isStreaming = loading && streaming.status !== 'idle';
  const hasActiveConversation = !!activeConversation;
  const showInitialPrompt = !hasActiveConversation && !loading;
  const showFollowUpPrompt = hasActiveConversation || loading;
  const error = generationError || activeError;

  const handleClearError = () => {
    clearGenerationError();
    clearActiveError();
  };

  return (
    <div className={`max-w-4xl mx-auto py-8 px-6 ${showFollowUpPrompt ? 'pb-40' : ''}`}>
      <header className="text-center mb-8">
        <h1 className="text-4xl font-bold text-slate-900 mb-2">OpenSCAD AI Model Generator</h1>
        <p className="text-slate-600">
          {hasActiveConversation
            ? 'Add follow-up prompts to refine your model'
            : 'Describe your 3D model and watch AI create it in real-time'}
        </p>
      </header>

      <div className="space-y-6">
        {/* Initial Prompt Input */}
        {showInitialPrompt && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <PromptInput onSubmit={addMessage} loading={loading} />
          </div>
        )}

        {/* Error Display */}
        {error && <ErrorDisplay message={error} onDismiss={handleClearError} />}

        {/* Conversation View */}
        {activeConversation && (
          <ConversationView
            conversation={activeConversation}
            streaming={streaming}
            scrollContainerRef={scrollContainerRef}
          />
        )}

        {/* Preview Approval */}
        {streaming.status === 'awaiting_approval' && streaming.previewUrl && (
          <PreviewApprovalCard
            previewUrl={streaming.previewUrl}
            onApprove={() => approvePreview()}
            onReject={() => rejectPreview('')}
          />
        )}

        {/* Validation Prompt */}
        {validationPrompt && (
          <ValidationPromptCard
            reason={validationPrompt.reason}
            previewUrl={validationPrompt.previewUrl}
            onRetry={() => retryValidation(validationPrompt.reason)}
            onIgnore={() => finalizeValidation()}
          />
        )}

        {/* Empty State */}
        {!hasActiveConversation && !isStreaming && <EmptyState />}
      </div>

      <footer className="mt-12 text-center text-slate-500 text-sm pb-10">
        <p>Created by: Lukas Sorensen | {new Date().getFullYear()} ©</p>
      </footer>
    </div>
  );
}
