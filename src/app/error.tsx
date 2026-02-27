"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-4 pt-14 md:p-8 md:pt-8 max-w-xl">
      <h2 className="text-lg font-bold text-stone-900 mb-2">
        Something went wrong
      </h2>
      <p className="text-sm text-stone-500 mb-4">
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-800 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
