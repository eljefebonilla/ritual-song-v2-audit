import type { MusicPlan, SongEntry, ResolvedSong } from "@/lib/types";
import { normalizeTitle } from "@/lib/occasion-helpers";
import SongSlot from "./SongSlot";
import InteractiveSongSlot from "./InteractiveSongSlot";

interface OrderOfWorshipProps {
  plan: MusicPlan;
  seasonColor: string;
  resolvedSongs?: Record<string, ResolvedSong>;
}

function SectionHeader({
  title,
  color,
}: {
  title: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-stone-50 border-y border-stone-100">
      <div
        className="w-1 h-4 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-[10px] uppercase tracking-widest font-bold text-stone-500">
        {title}
      </span>
    </div>
  );
}

function SongRow({
  label,
  song,
  resolvedSongs,
  section,
}: {
  label: string;
  song?: SongEntry;
  resolvedSongs?: Record<string, ResolvedSong>;
  section?: "introductory" | "word" | "eucharist" | "concluding";
}) {
  if (!song) return <SongSlot label={label} song={song} section={section} />;
  const resolved = resolvedSongs?.[normalizeTitle(song.title)];
  if (resolved) {
    return <InteractiveSongSlot label={label} song={song} resolved={resolved} />;
  }
  return <SongSlot label={label} song={song} section={section} />;
}

export default function OrderOfWorship({
  plan,
  seasonColor,
  resolvedSongs,
}: OrderOfWorshipProps) {
  const hasAnyData =
    plan.prelude ||
    plan.gathering ||
    plan.penitentialAct ||
    plan.gloria ||
    plan.offertory ||
    plan.sending;

  if (!hasAnyData) {
    return (
      <div className="px-4 py-8 text-center text-sm text-stone-400">
        No music data for this community yet.
      </div>
    );
  }

  // Check if psalm / GA have library matches
  const psalmResolved = plan.responsorialPsalm
    ? resolvedSongs?.[normalizeTitle(plan.responsorialPsalm.psalm)]
    : undefined;
  const gaResolved = plan.gospelAcclamation
    ? resolvedSongs?.[normalizeTitle(plan.gospelAcclamation.title)]
    : undefined;

  return (
    <div className="divide-y divide-stone-100">
      {/* Meta info */}
      {(plan.presider || (plan.massNotes && plan.massNotes.length > 0)) && (
        <div className="px-3 py-2">
          {plan.presider && (
            <p className="text-xs text-stone-500">
              <span className="font-semibold">Presider:</span> {plan.presider}
            </p>
          )}
          {plan.massNotes?.map((note, i) => (
            <p key={i} className="text-xs text-stone-400 italic">
              {note}
            </p>
          ))}
        </div>
      )}

      {/* INTRODUCTORY RITES */}
      <SectionHeader title="Introductory Rites" color={seasonColor} />
      <SongRow label="Prelude" song={plan.prelude} resolvedSongs={resolvedSongs} section="introductory" />
      <SongRow label="Gathering" song={plan.gathering} resolvedSongs={resolvedSongs} section="introductory" />
      <SongRow label="Penitential Act" song={plan.penitentialAct} resolvedSongs={resolvedSongs} section="introductory" />
      <SongRow label="Gloria" song={plan.gloria} resolvedSongs={resolvedSongs} section="introductory" />

      {/* LITURGY OF THE WORD */}
      <SectionHeader title="Liturgy of the Word" color={seasonColor} />
      {plan.responsorialPsalm && (
        psalmResolved ? (
          <InteractiveSongSlot
            label="Psalm"
            song={{ title: plan.responsorialPsalm.psalm, description: plan.responsorialPsalm.setting }}
            resolved={psalmResolved}
          />
        ) : (
          <div className="flex items-start gap-3 py-2 px-3">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-400 w-28 shrink-0 pt-0.5">
              Psalm
            </span>
            <div>
              <p className="text-sm font-medium text-stone-800">
                {plan.responsorialPsalm.psalm}
              </p>
              {plan.responsorialPsalm.setting && (
                <p className="text-xs text-stone-500">
                  {plan.responsorialPsalm.setting}
                </p>
              )}
            </div>
          </div>
        )
      )}
      {plan.gospelAcclamation && (
        gaResolved ? (
          <InteractiveSongSlot
            label="Gospel Accl."
            song={{
              title: plan.gospelAcclamation.title,
              composer: plan.gospelAcclamation.composer,
              description: plan.gospelAcclamation.verse,
            }}
            resolved={gaResolved}
          />
        ) : (
          <div className="flex items-start gap-3 py-2 px-3">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-400 w-28 shrink-0 pt-0.5">
              Gospel Accl.
            </span>
            <div>
              <p className="text-sm font-medium text-stone-800">
                {plan.gospelAcclamation.title}
              </p>
              {plan.gospelAcclamation.composer && (
                <p className="text-xs text-stone-500">
                  {plan.gospelAcclamation.composer}
                </p>
              )}
              {plan.gospelAcclamation.verse && (
                <p className="text-xs text-stone-400 italic">
                  {plan.gospelAcclamation.verse}
                </p>
              )}
            </div>
          </div>
        )
      )}

      {/* LITURGY OF THE EUCHARIST */}
      <SectionHeader title="Liturgy of the Eucharist" color={seasonColor} />
      <SongRow label="Offertory" song={plan.offertory} resolvedSongs={resolvedSongs} section="eucharist" />
      {plan.eucharisticAcclamations && (
        <div className="flex items-start gap-3 py-2 px-3">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-400 w-28 shrink-0 pt-0.5">
            Mass Setting
          </span>
          <div>
            <p className="text-sm font-medium text-stone-800">
              {plan.eucharisticAcclamations.massSettingName}
            </p>
            {plan.eucharisticAcclamations.composer && (
              <p className="text-xs text-stone-500">
                {plan.eucharisticAcclamations.composer}
              </p>
            )}
          </div>
        </div>
      )}
      <SongRow label="Lord's Prayer" song={plan.lordsPrayer} resolvedSongs={resolvedSongs} section="eucharist" />
      <SongRow label="Fraction Rite" song={plan.fractionRite} resolvedSongs={resolvedSongs} section="eucharist" />
      {plan.communionSongs?.map((song, i) => (
        <SongRow
          key={i}
          label={i === 0 ? "Communion" : `Comm. ${i + 1}`}
          song={song}
          resolvedSongs={resolvedSongs}
          section="eucharist"
        />
      ))}

      {/* CONCLUDING RITES */}
      <SectionHeader title="The Concluding Rites" color={seasonColor} />
      <SongRow label="Sending" song={plan.sending} resolvedSongs={resolvedSongs} section="concluding" />
    </div>
  );
}
