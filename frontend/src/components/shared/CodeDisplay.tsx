/**
 * CodeDisplay Component
 * Displays code with copy functionality.
 */

import { copyToClipboard } from "../../utils/downloadUtils";

interface CodeDisplayProps {
  code: string;
  collapsible?: boolean;
  title?: string;
}

export function CodeDisplay({
  code,
  collapsible = false,
  title = "OpenSCAD Code",
}: CodeDisplayProps) {
  const handleCopy = async () => {
    await copyToClipboard(code);
  };

  const codeBlock = (
    <pre className="bg-slate-900 text-emerald-400 p-3 rounded text-xs overflow-x-auto max-h-64 overflow-y-auto">
      <code>{code}</code>
    </pre>
  );

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <h4 className="text-xs uppercase tracking-wide text-slate-500">
          {title}
        </h4>
        <button
          onClick={handleCopy}
          className="text-xs text-slate-600 hover:text-slate-800 transition-colors"
        >
          Copy code
        </button>
      </div>
      {collapsible ? (
        <details>
          <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
            View code
          </summary>
          <div className="mt-2">{codeBlock}</div>
        </details>
      ) : (
        codeBlock
      )}
    </div>
  );
}
