import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { rowToLiturgicalDay } from "@/lib/liturgical-helpers";
import { LITURGICAL_COLOR_HEX, LITURGICAL_COLOR_LIGHT, LITURGICAL_COLOR_LABEL } from "@/lib/liturgical-colors";
import { SEASON_COLORS } from "@/lib/liturgical-colors";
import { rankLabel } from "@/lib/liturgical-helpers";

export const dynamic = "force-dynamic";

interface DayPageProps {
  params: Promise<{ date: string }>;
}

export default async function DayPage({ params }: DayPageProps) {
  const { date } = await params;

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-xl font-bold text-stone-800">Invalid date</h1>
        <p className="text-stone-500 mt-2">Expected format: YYYY-MM-DD</p>
      </div>
    );
  }

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("liturgical_days")
    .select("*")
    .eq("date", date);

  if (error || !data || data.length === 0) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-xl font-bold text-stone-800">No data</h1>
        <p className="text-stone-500 mt-2">
          No liturgical data found for {date}.
        </p>
      </div>
    );
  }

  const universal = data.find(
    (d: Record<string, unknown>) => d.ecclesiastical_province === "__universal__"
  );
  const litDay = rowToLiturgicalDay(universal || data[0]);

  // If this date has an occasion, redirect to the full occasion page
  if (litDay.occasionId) {
    redirect(`/occasion/${litDay.occasionId}`);
  }

  const colorHex = LITURGICAL_COLOR_HEX[litDay.colorPrimary];
  const colorLight = LITURGICAL_COLOR_LIGHT[litDay.colorPrimary];
  const colorName = LITURGICAL_COLOR_LABEL[litDay.colorPrimary];
  const seasonInfo = SEASON_COLORS[litDay.season];

  const displayDate = new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="max-w-3xl mx-auto pb-12">
      {/* Color bar */}
      <div className="h-[6px]" style={{ backgroundColor: colorHex }} />

      {/* Header */}
      <div className="px-6 pt-6 pb-4" style={{ backgroundColor: colorLight }}>
        <div className="flex items-center gap-2 mb-2">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: colorHex }}
          />
          <span
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: colorHex }}
          >
            {rankLabel(litDay.rank)}
          </span>
          <span className="text-xs text-stone-400">|</span>
          <span className="text-xs text-stone-500">{colorName}</span>
        </div>

        <h1 className="text-2xl font-bold text-stone-900 mb-1">
          {litDay.celebrationName}
        </h1>

        <p className="text-sm text-stone-500">
          <span style={{ color: seasonInfo?.primary }}>
            {seasonInfo?.label || litDay.season}
          </span>
          {" \u2022 "}
          {displayDate}
        </p>
      </div>

      {/* Quick stats */}
      <div className="px-6 py-3 flex flex-wrap gap-4 border-b border-stone-200 bg-white">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-stone-400">Gloria</span>
          {litDay.gloria ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a8a29e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-stone-400">Alleluia</span>
          {litDay.alleluia ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a8a29e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          )}
          {!litDay.alleluia && (
            <span className="text-[10px] text-stone-400">Use Lenten Gospel Acclamation</span>
          )}
        </div>
        {litDay.psalterWeek && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-stone-400">Psalter</span>
            <span className="text-xs font-semibold text-stone-700 bg-stone-100 px-1.5 py-0.5 rounded">
              Week {litDay.psalterWeek}
            </span>
          </div>
        )}
        {litDay.lectionaryNumber && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-stone-400">Lectionary</span>
            <span className="text-xs font-semibold text-stone-700 bg-stone-100 px-1.5 py-0.5 rounded">
              #{litDay.lectionaryNumber}
            </span>
          </div>
        )}
      </div>

      {/* Saint spotlight */}
      {litDay.saintName && (
        <div
          className="mx-6 mt-4 p-4 rounded-lg border-l-[3px] bg-white"
          style={{ borderLeftColor: colorHex }}
        >
          <p className="text-sm font-semibold text-stone-800">
            {litDay.saintName}
          </p>
          {litDay.saintTitle && (
            <p className="text-xs text-stone-500 mt-0.5">
              {litDay.saintTitle}
            </p>
          )}
        </div>
      )}

      {/* Optional memorials */}
      {litDay.optionalMemorials && litDay.optionalMemorials.length > 0 && (
        <div className="mx-6 mt-3 p-3 bg-stone-50 rounded-lg">
          <p className="text-[10px] uppercase tracking-wide text-stone-400 font-semibold mb-1">
            Optional Memorials
          </p>
          {litDay.optionalMemorials.map((m, i) => (
            <p key={i} className="text-xs text-stone-600">{m}</p>
          ))}
        </div>
      )}

      {/* BVM indicator */}
      {litDay.isBVM && (
        <div className="mx-6 mt-3 p-3 bg-blue-50 rounded-lg">
          <p className="text-xs text-blue-700">
            Optional Memorial of the Blessed Virgin Mary may be observed on this Saturday.
          </p>
        </div>
      )}
    </div>
  );
}
