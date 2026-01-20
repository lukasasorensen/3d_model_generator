/**
 * PreviewApprovalCard Component
 * Displays a preview image and approval/rejection buttons for model preview.
 */

interface PreviewApprovalCardProps {
  previewUrl: string;
  onApprove: () => void;
  onReject: () => void;
}

export function PreviewApprovalCard({
  previewUrl,
  onApprove,
  onReject,
}: PreviewApprovalCardProps) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-blue-800 mb-2">
          Does this model look correct?
        </h3>
        <p className="text-sm text-blue-600 mb-4">
          Review the preview below and let us know if it matches your request.
        </p>
        <img
          src={previewUrl}
          alt="Model preview"
          className="mx-auto rounded-lg border border-blue-200 mb-6 max-w-full"
        />
        <div className="flex justify-center gap-4">
          <button
            onClick={onApprove}
            className="px-6 py-3 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            Yes, looks good!
          </button>
          <button
            onClick={onReject}
            className="px-6 py-3 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
          >
            No, needs changes
          </button>
        </div>
      </div>
    </div>
  );
}
