"use client";

interface PsalmNumberPickerProps {
  availableNumbers: Set<number>;
  selectedNumber: number | null;
  onSelect: (num: number | null) => void;
  range: [number, number];
  /** When a season or type is active, only show these numbers */
  seasonNumbers?: Set<number>;
}

export default function PsalmNumberPicker({ availableNumbers, selectedNumber, onSelect, range, seasonNumbers }: PsalmNumberPickerProps) {
  const [min, max] = range;

  // When season/type is active, show only relevant numbers in a single wrapped row
  if (seasonNumbers) {
    const numbers = Array.from(seasonNumbers).filter(n => n >= min && n <= max).sort((a, b) => a - b);
    if (numbers.length === 0) return null;
    return (
      <div className="flex flex-wrap items-center gap-0.5 py-1.5 px-1">
        {numbers.map((num) => (
          <NumButton key={num} num={num} available={availableNumbers.has(num)} selected={selectedNumber === num} onSelect={onSelect} />
        ))}
      </div>
    );
  }

  // Full range — split into rows
  const total = max - min + 1;
  // ≤25: single row (Book III/IV). 26-50: split in half. 51+: rows of 25.
  const rowSize = total <= 25 ? total : total > 50 ? 25 : Math.ceil(total / 2);

  const rows: number[][] = [];
  for (let start = min; start <= max; start += rowSize) {
    const end = Math.min(start + rowSize - 1, max);
    rows.push(Array.from({ length: end - start + 1 }, (_, i) => start + i));
  }

  return (
    <div className="py-1.5 px-1 space-y-0.5 overflow-x-auto scrollbar-hide">
      {rows.map((row) => (
        <div key={row[0]} className="flex items-center gap-0.5 min-w-max">
          {row.map((num) => (
            <NumButton key={num} num={num} available={availableNumbers.has(num)} selected={selectedNumber === num} onSelect={onSelect} />
          ))}
        </div>
      ))}
    </div>
  );
}

function NumButton({ num, available, selected, onSelect }: {
  num: number;
  available: boolean;
  selected: boolean;
  onSelect: (num: number | null) => void;
}) {
  return (
    <button
      onClick={() => available && onSelect(selected ? null : num)}
      disabled={!available}
      className={`shrink-0 w-7 h-7 flex items-center justify-center text-[10px] rounded transition-colors ${
        selected
          ? "bg-stone-900 text-white font-bold"
          : available
          ? "font-medium text-stone-600 hover:bg-stone-200 cursor-pointer"
          : "text-stone-300 cursor-default"
      }`}
    >
      {num}
    </button>
  );
}
