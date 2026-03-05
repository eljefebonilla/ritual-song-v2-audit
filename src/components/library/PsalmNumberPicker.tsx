"use client";

interface PsalmNumberPickerProps {
  availableNumbers: Set<number>;
  selectedNumber: number | null;
  onSelect: (num: number | null) => void;
  range: [number, number];
  /** When a season is active, only show these numbers (lectionary assignments) */
  seasonNumbers?: Set<number>;
}

export default function PsalmNumberPicker({ availableNumbers, selectedNumber, onSelect, range, seasonNumbers }: PsalmNumberPickerProps) {
  const [min, max] = range;

  // When season is active, show only season-relevant numbers
  // When no season, show full range
  const numbers = seasonNumbers
    ? Array.from(seasonNumbers).filter(n => n >= min && n <= max).sort((a, b) => a - b)
    : Array.from({ length: max - min + 1 }, (_, i) => min + i);

  if (seasonNumbers && numbers.length === 0) return null;

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto py-1.5 px-1 scrollbar-hide">
      {numbers.map((num) => {
        const hasSetting = availableNumbers.has(num);
        const isSelected = selectedNumber === num;
        return (
          <button
            key={num}
            onClick={() => hasSetting && onSelect(isSelected ? null : num)}
            disabled={!hasSetting}
            className={`shrink-0 w-7 h-7 flex items-center justify-center text-[10px] rounded transition-colors ${
              isSelected
                ? "bg-stone-900 text-white font-bold"
                : hasSetting
                ? "font-medium text-stone-600 hover:bg-stone-200 cursor-pointer"
                : "text-stone-300 cursor-default"
            }`}
          >
            {num}
          </button>
        );
      })}
    </div>
  );
}
