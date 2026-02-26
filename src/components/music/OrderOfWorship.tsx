import type { MusicPlan } from "@/lib/types";
import SongSlot from "./SongSlot";

interface OrderOfWorshipProps {
  plan: MusicPlan;
  seasonColor: string;
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

export default function OrderOfWorship({
  plan,
  seasonColor,
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
      <SongSlot label="Prelude" song={plan.prelude} section="introductory" />
      <SongSlot label="Gathering" song={plan.gathering} section="introductory" />
      <SongSlot label="Penitential Act" song={plan.penitentialAct} section="introductory" />
      <SongSlot label="Gloria" song={plan.gloria} section="introductory" />

      {/* LITURGY OF THE WORD */}
      <SectionHeader title="Liturgy of the Word" color={seasonColor} />
      {plan.responsorialPsalm && (
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
      )}
      {plan.gospelAcclamation && (
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
      )}

      {/* LITURGY OF THE EUCHARIST */}
      <SectionHeader title="Liturgy of the Eucharist" color={seasonColor} />
      <SongSlot label="Offertory" song={plan.offertory} section="eucharist" />
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
      <SongSlot label="Lord's Prayer" song={plan.lordsPrayer} section="eucharist" />
      <SongSlot label="Fraction Rite" song={plan.fractionRite} section="eucharist" />
      {plan.communionSongs?.map((song, i) => (
        <SongSlot
          key={i}
          label={i === 0 ? "Communion" : `Comm. ${i + 1}`}
          song={song}
          section="eucharist"
        />
      ))}

      {/* CONCLUDING RITES */}
      <SectionHeader title="The Concluding Rites" color={seasonColor} />
      <SongSlot label="Sending" song={plan.sending} section="concluding" />
    </div>
  );
}
