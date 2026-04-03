import Link from "next/link";

const LITURGY_TYPES = [
  {
    id: "wedding",
    label: "Wedding",
    icon: "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z",
    color: "bg-rose-50 text-rose-700 border-rose-200",
    description: "Nuptial Mass, Rite of Marriage outside Mass",
  },
  {
    id: "funeral",
    label: "Funeral",
    icon: "M17 10h2a2 2 0 0 1 0 4h-1M9 10H7a2 2 0 0 0 0 4h1M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83",
    color: "bg-stone-100 text-stone-700 border-stone-300",
    description: "Vigil, Funeral Mass, Committal",
  },
  {
    id: "baptism",
    label: "Baptism",
    icon: "M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10zM12 6v6l4 2",
    color: "bg-sky-50 text-sky-700 border-sky-200",
    description: "Infant Baptism, OCIA Rites",
  },
  {
    id: "reconciliation",
    label: "Reconciliation Service",
    icon: "M3 12h18M12 3v18",
    color: "bg-violet-50 text-violet-700 border-violet-200",
    description: "Communal Penance Service, Advent/Lenten",
  },
  {
    id: "benediction",
    label: "Benediction / Exposition",
    icon: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
    color: "bg-amber-50 text-amber-700 border-amber-200",
    description: "Eucharistic Adoration, Benediction, Holy Hour",
  },
  {
    id: "stations",
    label: "Stations of the Cross",
    icon: "M12 2v20M2 12h20",
    color: "bg-purple-50 text-purple-800 border-purple-200",
    description: "14 Stations, Lenten devotion",
  },
  {
    id: "children",
    label: "Masses with Children",
    icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
    color: "bg-green-50 text-green-700 border-green-200",
    description: "Children's Liturgy of the Word, School Masses",
  },
  {
    id: "civic",
    label: "Civic / Holiday Masses",
    icon: "M3 21h18M3 10h18M3 7l9-4 9 4M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    description: "Independence Day, Thanksgiving, Memorial Day, Veterans Day",
  },
];

export default function LiturgiesPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-stone-900">Other Liturgies</h1>
        <p className="text-sm text-stone-500 mt-1">
          Sacramental celebrations, devotions, and special liturgies beyond Sunday Mass.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {LITURGY_TYPES.map((type) => (
          <Link
            key={type.id}
            href={`/liturgies/${type.id}`}
            className={`flex items-start gap-4 p-4 rounded-lg border transition-all hover:shadow-sm hover:-translate-y-0.5 ${type.color}`}
          >
            <div className="shrink-0 mt-0.5">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={type.icon} />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold">{type.label}</h2>
              <p className="text-[11px] opacity-70 mt-0.5">{type.description}</p>
              <span className="text-[10px] font-medium opacity-50 mt-2 inline-block">
                0 events planned
              </span>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-8 pt-6 border-t border-stone-200">
        <p className="text-[11px] text-stone-400">
          Each liturgy type will have its own music planning template, suggested songs based on rites and readings,
          and scheduling tools. Coming soon.
        </p>
      </div>
    </div>
  );
}
