"use client";

interface PsalmNumberPickerProps {
  availableNumbers: Set<number>;
  selectedNumber: number | null;
  onSelect: (num: number | null) => void;
}

export default function PsalmNumberPicker({ availableNumbers, selectedNumber, onSelect }: PsalmNumberPickerProps) {
  return (
    <div className="flex items-center gap-0.5 overflow-x-auto py-1.5 px-1 scrollbar-hide">
      <button
        onClick={() => onSelect(null)}
        className={`shrink-0 px-2 py-1 text-[10px] font-bold rounded transition-colors ${
          selectedNumber === null
            ? "bg-stone-900 text-white"
            : "text-stone-500 hover:bg-stone-100"
        }`}
      >
        All
      </button>
      {Array.from({ length: 150 }, (_, i) => i + 1).map((num) => {
        const available = availableNumbers.has(num);
        const isSelected = selectedNumber === num;
        return (
          <button
            key={num}
            onClick={() => available && onSelect(isSelected ? null : num)}
            disabled={!available}
            className={`shrink-0 w-7 h-7 flex items-center justify-center text-[10px] rounded transition-colors ${
              isSelected
                ? "bg-stone-900 text-white font-bold"
                : available
                ? "font-medium text-stone-600 hover:bg-stone-200 cursor-pointer"
                : "text-stone-200 cursor-default"
            }`}
          >
            {num}
          </button>
        );
      })}
    </div>
  );
}
