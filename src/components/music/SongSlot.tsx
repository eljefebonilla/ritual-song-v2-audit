import type { SongEntry } from "@/lib/types";

interface SongSlotProps {
  label: string;
  song?: SongEntry;
  section?: "introductory" | "word" | "eucharist" | "concluding";
}

export default function SongSlot({ label, song }: SongSlotProps) {
  return (
    <div className="flex items-start gap-3 py-2 px-3">
      <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-400 w-28 shrink-0 pt-0.5">
        {label}
      </span>
      {/* Empty bullet column to align with InteractiveSongSlot */}
      <span className="w-3 shrink-0" />
      {song ? (
        <div className="min-w-0">
          <p className="text-sm font-medium text-stone-800 leading-snug">
            {song.title}
          </p>
          {song.composer && (
            <p className="text-xs text-stone-500">{song.composer}</p>
          )}
          {song.description && song.description !== "Description" && (
            <p className="text-xs text-stone-400 italic">{song.description}</p>
          )}
        </div>
      ) : (
        <span className="text-sm text-stone-200">&mdash;</span>
      )}
    </div>
  );
}
