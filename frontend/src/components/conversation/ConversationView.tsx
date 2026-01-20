/**
 * ConversationView Component
 * Displays the conversation history with messages.
 */

import { RefObject, useEffect, useRef, useState } from "react";
import { Conversation } from "../../types";
import { StreamingCodeDisplay } from "../generation/StreamingCodeDisplay.tsx";
import { MessageItem } from "./MessageItem";
import { StreamingState } from "../../hooks/useStreamingState";

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
