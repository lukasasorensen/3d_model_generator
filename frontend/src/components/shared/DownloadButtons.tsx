/**
 * DownloadButtons Component
 * Download buttons for model files.
 */

import { downloadAsFile } from "../../utils/downloadUtils";

interface DownloadButtonsProps {
  modelUrl: string;
  format?: "stl" | "3mf";
  scadCode?: string;
}

export function DownloadButtons({
  modelUrl,
  format = "stl",
  scadCode,
}: DownloadButtonsProps) {
  const handleDownloadScad = () => {
    if (scadCode) {
      downloadAsFile(scadCode, "model.scad", "text/plain");
    }
  };

  return (
    <div className="flex gap-3 flex-wrap">
      <a
        href={modelUrl}
        download={`model.${format}`}
        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
      >
        Download {format.toUpperCase()}
      </a>
      {scadCode && (
        <button
          onClick={handleDownloadScad}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          Download .scad
        </button>
      )}
    </div>
  );
}
