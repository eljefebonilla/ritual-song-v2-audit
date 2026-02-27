"use client";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

interface AlphabetJumpProps {
  availableLetters: Set<string>;
  onLetterClick: (letter: string) => void;
}

export default function AlphabetJump({ availableLetters, onLetterClick }: AlphabetJumpProps) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 px-1 py-2 select-none">
      {LETTERS.map((letter) => {
        const available = availableLetters.has(letter);
        return (
          <button
            key={letter}
            onClick={() => available && onLetterClick(letter)}
            disabled={!available}
            className={`w-7 h-7 flex items-center justify-center text-xs rounded transition-colors ${
              available
                ? "font-bold text-stone-700 hover:bg-stone-200 hover:text-stone-900 cursor-pointer"
                : "text-stone-300 cursor-default"
            }`}
          >
            {letter}
          </button>
        );
      })}
    </div>
  );
}
