/**
 * ConversationSidebar Component
 * Displays the list of conversations with selection and actions.
 */

import { useEffect } from "react";
import { ConversationListItem } from "../../types";
import { formatRelativeDate } from "../../utils/dateUtils";

interface ConversationSidebarProps {
  conversations: ConversationListItem[];
  activeConversationId?: string;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onRefresh: () => void;
}

export function ConversationSidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onRefresh,
}: ConversationSidebarProps) {
  useEffect(() => {
    onRefresh();
  }, [onRefresh]);

  return (
    <div className="w-72 bg-slate-900 text-white flex flex-col h-full">
      <div className="p-4 border-b border-slate-700">
        <button
          onClick={onNewConversation}
          className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
              clipRule="evenodd"
            />
          </svg>
          New Model
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-4 text-center text-slate-400">
            <p className="text-sm">No conversations yet</p>
            <p className="text-xs mt-1">Start by creating a new model</p>
          </div>
        ) : (
          <ul className="py-2">
            {conversations.map((conv) => (
              <li key={conv.id}>
                <div
                  onClick={() => onSelectConversation(conv.id)}
                  className={`w-full px-4 py-3 text-left hover:bg-slate-800 transition-colors group cursor-pointer ${
                    activeConversationId === conv.id ? "bg-slate-800" : ""
                  }`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectConversation(conv.id);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {conv.title || "Untitled"}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {conv.messageCount} message
                        {conv.messageCount !== 1 ? "s" : ""} •{" "}
                        {formatRelativeDate(conv.updatedAt)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteConversation(conv.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-700 rounded transition-all"
                      title="Delete conversation"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 text-slate-400 hover:text-red-400"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="p-4 border-t border-slate-700">
        <p className="text-xs text-slate-500 text-center">
          OpenSCAD AI Generator
        </p>
      </div>
    </div>
  );
}
