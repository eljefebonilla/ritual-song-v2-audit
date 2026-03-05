"use client";

interface PsalmNumberPickerProps {
  availableNumbers: Set<number>;
  selectedNumber: number | null;
  onSelect: (num: number | null) => void;
  range: [number, number];
}

export default function PsalmNumberPicker({ availableNumbers, selectedNumber, onSelect, range }: PsalmNumberPickerProps) {
  const [min, max] = range;

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto py-1.5 px-1 scrollbar-hide">
      {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((num) => {
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
