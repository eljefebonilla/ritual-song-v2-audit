"use client";

interface PsalmNumberPickerProps {
  availableNumbers: Set<number>;
  selectedNumber: number | null;
  onSelect: (num: number | null) => void;
}

export default function PsalmNumberPicker({ availableNumbers, selectedNumber, onSelect }: PsalmNumberPickerProps) {
  const sorted = [...availableNumbers].sort((a, b) => a - b);

  if (sorted.length === 0) return null;

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto py-1.5 px-1 scrollbar-hide">
      {sorted.map((num) => {
        const isSelected = selectedNumber === num;
        return (
          <button
            key={num}
            onClick={() => onSelect(isSelected ? null : num)}
            className={`shrink-0 w-7 h-7 flex items-center justify-center text-[10px] rounded transition-colors ${
              isSelected
                ? "bg-stone-900 text-white font-bold"
                : "font-medium text-stone-600 hover:bg-stone-200 cursor-pointer"
            }`}
          >
            {num}
          </button>
        );
      })}
    </div>
  );
}
