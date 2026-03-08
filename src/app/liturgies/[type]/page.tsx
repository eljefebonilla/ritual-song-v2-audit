import Link from "next/link";

const LITURGY_META: Record<string, { label: string; sections: string[]; color: string }> = {
  wedding: {
    label: "Wedding",
    color: "bg-rose-700",
    sections: [
      "Prelude", "Processional", "Gathering Hymn", "Responsorial Psalm",
      "Gospel Acclamation", "Offertory", "Holy Holy", "Memorial Acclamation",
      "Great Amen", "Lord's Prayer", "Lamb of God", "Communion",
      "Unity Candle / Special Music", "Recessional",
    ],
  },
  funeral: {
    label: "Funeral",
    color: "bg-stone-700",
    sections: [
      "Gathering / Entrance", "Responsorial Psalm", "Gospel Acclamation",
      "Offertory", "Holy Holy", "Memorial Acclamation", "Great Amen",
      "Lord's Prayer", "Lamb of God", "Communion", "Song of Farewell",
      "Recessional",
    ],
  },
  baptism: {
    label: "Baptism",
    color: "bg-sky-700",
    sections: [
      "Gathering", "Responsorial Psalm", "Acclamation after Baptism",
      "Offertory", "Communion", "Sending Forth",
    ],
  },
  reconciliation: {
    label: "Reconciliation Service",
    color: "bg-violet-700",
    sections: [
      "Opening Hymn", "Responsorial Psalm", "Examination of Conscience",
      "Act of Contrition", "Closing Hymn",
    ],
  },
  benediction: {
    label: "Benediction / Exposition",
    color: "bg-amber-700",
    sections: [
      "Exposition Hymn", "Readings / Meditation", "Tantum Ergo",
      "Divine Praises", "Reposition Hymn",
    ],
  },
  stations: {
    label: "Stations of the Cross",
    color: "bg-purple-800",
    sections: [
      "Opening Hymn",
      ...Array.from({ length: 14 }, (_, i) => `Station ${i + 1}`),
      "Closing Prayer / Hymn",
    ],
  },
  children: {
    label: "Masses with Children",
    color: "bg-green-700",
    sections: [
      "Gathering", "Gloria", "Responsorial Psalm", "Gospel Acclamation",
      "Offertory", "Holy Holy", "Communion", "Sending Forth",
    ],
  },
  civic: {
    label: "Civic / Holiday Masses",
    color: "bg-blue-700",
    sections: [
      "Prelude", "Gathering", "Responsorial Psalm", "Gospel Acclamation",
      "Offertory", "Communion", "Patriotic Hymn", "Sending Forth",
    ],
  },
};

export default async function LiturgyTypePage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  const meta = LITURGY_META[type];

  if (!meta) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12 text-center">
        <h1 className="text-lg font-bold text-stone-900">Liturgy type not found</h1>
        <Link href="/liturgies" className="text-sm text-amber-700 hover:underline mt-2 inline-block">
          Back to Liturgies
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/liturgies"
          className="text-stone-400 hover:text-stone-600 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-stone-900">{meta.label}</h1>
          <p className="text-xs text-stone-400 mt-0.5">Music planning template</p>
        </div>
      </div>

      {/* Season accent bar */}
      <div className={`h-1 rounded-full ${meta.color} mb-6`} />

      {/* Empty planning slots */}
      <div className="space-y-1">
        {meta.sections.map((section, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 py-3 bg-white border border-stone-100 rounded-lg hover:border-stone-200 transition-colors group"
          >
            <span className="text-[10px] font-bold text-stone-300 w-5 text-right tabular-nums">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-stone-600">{section}</p>
              <p className="text-[10px] text-stone-300 mt-0.5 italic">
                No song selected
              </p>
            </div>
            <button
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-stone-100"
              title="Browse songs for this slot"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-stone-400">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* Event log */}
      <div className="mt-8 pt-6 border-t border-stone-200">
        <h2 className="text-xs font-bold text-stone-500 uppercase tracking-wide mb-3">
          Upcoming Events
        </h2>
        <div className="text-center py-8">
          <p className="text-sm text-stone-300">No {meta.label.toLowerCase()} events scheduled</p>
          <button className="mt-3 text-xs font-medium text-amber-700 hover:text-amber-900 transition-colors">
            + Schedule Event
          </button>
        </div>
      </div>
    </div>
  );
}
