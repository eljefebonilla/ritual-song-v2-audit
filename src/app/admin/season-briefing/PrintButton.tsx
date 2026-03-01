"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="mb-6 px-4 py-2 text-xs font-medium bg-stone-900 text-white rounded-md hover:bg-stone-800 transition-colors print:hidden"
    >
      Print Briefing
    </button>
  );
}
