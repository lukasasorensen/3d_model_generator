/**
 * EmptyState Component
 * Displays when no conversation is active.
 */

export function EmptyState() {
  return (
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
      <h2 className="text-2xl font-semibold text-slate-800 mb-2">Create Your First Model</h2>
      <p className="text-slate-600 max-w-md mx-auto">
        Describe the 3D model you want to create in the text box above. The AI will generate OpenSCAD code and
        compile it into a downloadable 3D model.
      </p>
    </div>
  );
}
