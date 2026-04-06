import type { SongEntry } from "@/lib/types";
import InlinePlayButton from "@/components/ui/InlinePlayButton";

interface SongSlotProps {
  label: string;
  song?: SongEntry;
  section?: "introductory" | "word" | "eucharist" | "concluding";
  rightAction?: React.ReactNode;
  isLiturgicalText?: boolean;
}

export default function SongSlot({ label, song, rightAction, isLiturgicalText }: SongSlotProps) {
  return (
    <div className="flex items-start gap-3 py-2 px-3">
      <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-400 w-28 shrink-0 pt-0.5">
        {label}
      </span>
      {/* Play button column — grey disabled for unresolved songs */}
      <span className="w-7 shrink-0 flex items-start justify-center pt-0.5">
        {song && <InlinePlayButton audioUrl={null} audioType={null} title={song.title} />}
      </span>
      {song ? (
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-stone-800 leading-snug">
            {song.title}
          </p>
          {song.composer && (
            <p className="text-xs text-stone-500">{song.composer}</p>
          )}
          {song.description && song.description !== "Description" && (
            <p className={`text-xs italic ${isLiturgicalText ? "text-parish-burgundy" : "text-stone-400"}`}>{song.description}</p>
          )}
        </div>
      ) : (
        <span className="text-sm text-stone-200 flex-1">&mdash;</span>
      )}
      {rightAction}
    </div>
  );
}
