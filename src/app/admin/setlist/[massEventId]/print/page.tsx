export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import type { Setlist, SetlistSongRow, SetlistPersonnel, SetlistSafetySong } from "@/lib/booking-types";
import PrintButton from "@/components/setlist/PrintButton";

interface Props {
  params: Promise<{ massEventId: string }>;
}

function formatPrintDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function SongRow({ row }: { row: SetlistSongRow }) {
  const song = row.songs[0];
  if (!song && !row.display_value && !row.thematic_note) return null;

  return (
    <div className="setlist-row">
      <span className="setlist-label">{row.label}</span>
      <span className="setlist-dots" />
      <span className="setlist-value">
        {row.thematic_note && (
          <em className="setlist-thematic">{row.thematic_note}</em>
        )}
        {row.display_value && (
          <span className="setlist-display-value">{row.display_value}</span>
        )}
        {song && (
          <>
            <span className="setlist-title">{song.title}</span>
            {song.composer && (
              <span className="setlist-composer"> — {song.composer}</span>
            )}
            {song.hymnal_number && (
              <span className="setlist-hymnal"> ({song.hymnal_number})</span>
            )}
          </>
        )}
        {row.assignment_text && (
          <span className="setlist-assignment"> [{row.assignment_text}]</span>
        )}
        {row.is_conditional && (
          <span className="setlist-conditional"> (if needed)</span>
        )}
      </span>
    </div>
  );
}

function PersonnelColumn({ personnel, label }: { personnel: SetlistPersonnel[]; label: string }) {
  if (personnel.length === 0) return null;
  return (
    <div className="setlist-personnel-col">
      {personnel.map((p, i) => (
        <div key={i} className="setlist-person">
          <span className="setlist-person-role">{p.role_label}:</span>{" "}
          <span className="setlist-person-name">{p.person_name}</span>
        </div>
      ))}
    </div>
  );
}

export default async function SetlistPrintPage({ params }: Props) {
  const { massEventId } = await params;
  const supabase = createAdminClient();

  const { data: mass } = await supabase
    .from("mass_events")
    .select("id, title, event_date, start_time_12h, ensemble, liturgical_name, season, choir_descriptor, celebrant")
    .eq("id", massEventId)
    .single();

  if (!mass) notFound();

  const { data: setlist } = await supabase
    .from("setlists")
    .select("*")
    .eq("mass_event_id", massEventId)
    .single();

  if (!setlist) notFound();

  const typed = setlist as Setlist;
  const songs = typed.songs as SetlistSongRow[];
  const personnel = typed.personnel as SetlistPersonnel[];
  const safetySong = typed.safety_song as SetlistSafetySong | null;
  const leftPersonnel = personnel.filter((p) => p.side === "left");
  const rightPersonnel = personnel.filter((p) => p.side === "right");

  return (
    <>
      <style>{`
        @media print {
          body { margin: 0; }
          .no-print { display: none !important; }
        }

        .setlist-page {
          max-width: 8.5in;
          margin: 0 auto;
          padding: 0.5in 0.6in;
          font-family: Garamond, Georgia, "Times New Roman", serif;
          color: #3A3A3A;
          font-size: 11pt;
          line-height: 1.4;
        }

        /* Header */
        .setlist-header {
          text-align: center;
          border-bottom: 2px solid #B8A472;
          padding-bottom: 8pt;
          margin-bottom: 14pt;
        }
        .setlist-parish {
          font-size: 8pt;
          text-transform: uppercase;
          letter-spacing: 3pt;
          color: #B8A472;
          margin-bottom: 2pt;
        }
        .setlist-occasion {
          font-size: 16pt;
          font-weight: bold;
          color: #3A3A3A;
          margin: 4pt 0 2pt;
        }
        .setlist-designation {
          font-size: 10pt;
          font-style: italic;
          color: #666;
          margin-bottom: 2pt;
        }
        .setlist-meta {
          font-size: 9pt;
          color: #888;
        }

        /* Song rows */
        .setlist-row {
          display: flex;
          align-items: baseline;
          gap: 4pt;
          padding: 2pt 0;
        }
        .setlist-label {
          font-variant: small-caps;
          font-size: 9pt;
          color: #B8A472;
          white-space: nowrap;
          min-width: 120pt;
          text-align: right;
        }
        .setlist-dots {
          flex: 1;
          border-bottom: 1px dotted #ccc;
          min-width: 12pt;
          margin-bottom: 2pt;
        }
        .setlist-value {
          text-align: left;
          max-width: 60%;
        }
        .setlist-title {
          font-weight: bold;
        }
        .setlist-composer {
          font-style: italic;
          font-size: 10pt;
          color: #666;
        }
        .setlist-hymnal {
          font-size: 9pt;
          color: #888;
        }
        .setlist-assignment {
          font-size: 9pt;
          color: #888;
        }
        .setlist-conditional {
          font-size: 8pt;
          font-style: italic;
          color: #aaa;
        }
        .setlist-thematic {
          font-size: 9pt;
          color: #888;
          display: block;
        }
        .setlist-display-value {
          font-style: italic;
          color: #666;
        }

        /* Divider */
        .setlist-divider {
          border: 0;
          border-top: 1px solid #e5e5e5;
          margin: 8pt 0;
        }

        /* Personnel footer */
        .setlist-footer {
          border-top: 2px solid #B8A472;
          margin-top: 16pt;
          padding-top: 8pt;
          display: flex;
          gap: 24pt;
        }
        .setlist-personnel-col {
          flex: 1;
        }
        .setlist-person {
          font-size: 9pt;
          line-height: 1.5;
        }
        .setlist-person-role {
          font-variant: small-caps;
          color: #B8A472;
        }
        .setlist-person-name {
          color: #3A3A3A;
        }

        /* Choir label */
        .setlist-choir {
          font-size: 9pt;
          font-variant: small-caps;
          color: #B8A472;
          margin-top: 6pt;
        }

        /* Safety song */
        .setlist-safety {
          margin-top: 10pt;
          padding-top: 6pt;
          border-top: 1px dashed #ccc;
          font-size: 9pt;
          color: #888;
        }
        .setlist-safety-label {
          font-variant: small-caps;
          color: #B8A472;
        }

        /* Print button */
        .print-btn {
          position: fixed;
          top: 16px;
          right: 16px;
          padding: 8px 16px;
          background: #3A3A3A;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
          z-index: 100;
        }
        .print-btn:hover { background: #555; }
      `}</style>

      <PrintButton />

      <div className="setlist-page">
        {/* Header */}
        <div className="setlist-header">
          <div className="setlist-parish">St. Monica Catholic Community</div>
          <div className="setlist-occasion">
            {typed.occasion_name || mass.liturgical_name || mass.title}
          </div>
          {typed.special_designation && (
            <div className="setlist-designation">{typed.special_designation}</div>
          )}
          <div className="setlist-meta">
            {formatPrintDate(mass.event_date)}
            {mass.start_time_12h && ` — ${mass.start_time_12h}`}
            {mass.ensemble && ` — ${mass.ensemble}`}
          </div>
        </div>

        {/* Songs */}
        {songs.map((row, i) => (
          <SongRow key={row.position + i} row={row} />
        ))}

        {/* Safety song */}
        {safetySong && safetySong.title && (
          <div className="setlist-safety">
            <span className="setlist-safety-label">Safety Song: </span>
            {safetySong.title}
            {safetySong.hymnal_number && ` (${safetySong.hymnal_number})`}
          </div>
        )}

        {/* Personnel footer */}
        {personnel.length > 0 && (
          <div className="setlist-footer">
            <PersonnelColumn personnel={leftPersonnel} label="Instruments" />
            <PersonnelColumn personnel={rightPersonnel} label="Vocals" />
          </div>
        )}

        {/* Choir label */}
        {typed.choir_label && (
          <div className="setlist-choir">Choir: {typed.choir_label}</div>
        )}
      </div>
    </>
  );
}
