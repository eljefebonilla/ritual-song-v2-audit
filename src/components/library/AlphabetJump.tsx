"use client";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

interface AlphabetJumpProps {
  availableLetters: Set<string>;
  onLetterClick: (letter: string) => void;
}

export default function AlphabetJump({ availableLetters, onLetterClick }: AlphabetJumpProps) {
  return (
    <div className="sticky top-0 flex flex-col items-center py-2 px-1 shrink-0 select-none z-10">
      {LETTERS.map((letter) => {
        const available = availableLetters.has(letter);
        return (
          <button
            key={letter}
            onClick={() => available && onLetterClick(letter)}
            disabled={!available}
            className={`w-5 h-5 flex items-center justify-center text-[10px] font-bold rounded transition-colors ${
              available
                ? "text-stone-600 hover:bg-stone-200 hover:text-stone-900 cursor-pointer"
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
