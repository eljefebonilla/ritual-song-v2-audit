"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { SetlistSongRow, SetlistPersonnel, SetlistSafetySong } from "@/lib/booking-types";

Font.register({
  family: "Serif",
  fonts: [
    { src: "https://cdn.jsdelivr.net/fontsource/fonts/playfair-display@latest/latin-400-normal.ttf", fontWeight: 400 },
    { src: "https://cdn.jsdelivr.net/fontsource/fonts/playfair-display@latest/latin-700-normal.ttf", fontWeight: 700 },
  ],
});
Font.register({
  family: "Sans",
  fonts: [
    { src: "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf", fontWeight: 400 },
    { src: "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-600-normal.ttf", fontWeight: 600 },
  ],
});

const gold = "#B8A472";
const charcoal = "#3A3A3A";
const muted = "#888888";

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 50, paddingHorizontal: 50, fontFamily: "Sans", fontSize: 10, color: charcoal },
  header: { textAlign: "center", borderBottomWidth: 2, borderBottomColor: gold, paddingBottom: 10, marginBottom: 16 },
  parish: { fontFamily: "Sans", fontSize: 7, letterSpacing: 3, textTransform: "uppercase", color: gold, marginBottom: 4 },
  occasion: { fontFamily: "Serif", fontSize: 18, fontWeight: 700, color: charcoal, marginBottom: 2 },
  designation: { fontFamily: "Serif", fontSize: 10, fontStyle: "italic", color: "#666", marginBottom: 2 },
  meta: { fontSize: 8, color: muted },
  songRow: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: "#E8E8E8" },
  songLabel: { width: 110, fontSize: 8, color: gold, textAlign: "right", paddingRight: 8 },
  songContent: { flex: 1 },
  songTitle: { fontSize: 10, fontWeight: 600, color: charcoal },
  songComposer: { fontSize: 8, color: "#666", fontStyle: "italic" },
  songHymnal: { fontSize: 7, color: muted },
  songThematic: { fontSize: 8, color: muted, fontStyle: "italic" },
  songDisplay: { fontSize: 9, color: "#666", fontStyle: "italic" },
  emptySlot: { fontSize: 9, color: "#C0C0C0", fontStyle: "italic" },
  personnelSection: { borderTopWidth: 2, borderTopColor: gold, marginTop: 16, paddingTop: 8, flexDirection: "row", gap: 20 },
  personnelCol: { flex: 1 },
  person: { fontSize: 8, marginBottom: 2 },
  personRole: { color: gold },
  personName: { color: charcoal },
  choirLabel: { fontSize: 8, color: gold, marginTop: 6 },
  safetySection: { marginTop: 10, paddingTop: 6, borderTopWidth: 0.5, borderTopColor: "#CCC", borderTopStyle: "dashed" },
  safetyLabel: { fontSize: 8, color: gold },
  safetyText: { fontSize: 8, color: muted },
  footer: { position: "absolute", bottom: 28, left: 50, right: 50, borderTopWidth: 0.5, borderTopColor: "#E8E8E8", paddingTop: 6, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 6, color: muted },
});

interface SetlistPDFProps {
  occasionName: string;
  specialDesignation?: string | null;
  dateDisplay: string;
  timeDisplay?: string | null;
  ensemble?: string | null;
  celebrant?: string | null;
  songs: SetlistSongRow[];
  personnel: SetlistPersonnel[];
  choirLabel?: string | null;
  safetySong?: SetlistSafetySong | null;
}

export default function SetlistPDF({
  occasionName,
  specialDesignation,
  dateDisplay,
  timeDisplay,
  ensemble,
  songs,
  personnel,
  choirLabel,
  safetySong,
}: SetlistPDFProps) {
  const leftPersonnel = personnel.filter((p) => p.side === "left");
  const rightPersonnel = personnel.filter((p) => p.side === "right");

  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        <View style={s.header}>
          <Text style={s.parish}>St. Monica Catholic Community</Text>
          <Text style={s.occasion}>{occasionName}</Text>
          {specialDesignation && <Text style={s.designation}>{specialDesignation}</Text>}
          <Text style={s.meta}>
            {dateDisplay}
            {timeDisplay ? ` \u2014 ${timeDisplay}` : ""}
            {ensemble ? ` \u2014 ${ensemble}` : ""}
          </Text>
        </View>

        {songs.map((row, i) => {
          const song = row.songs?.[0];
          if (!song && !row.display_value && !row.thematic_note) return null;
          return (
            <View key={row.position + i} style={s.songRow} wrap={false}>
              <Text style={s.songLabel}>{row.label}</Text>
              <View style={s.songContent}>
                {row.thematic_note && <Text style={s.songThematic}>{row.thematic_note}</Text>}
                {row.display_value && <Text style={s.songDisplay}>{row.display_value}</Text>}
                {song ? (
                  <>
                    <Text style={s.songTitle}>
                      {song.title}
                      {song.composer && <Text style={s.songComposer}> \u2014 {song.composer}</Text>}
                    </Text>
                    {song.hymnal_number && <Text style={s.songHymnal}>({song.hymnal_number})</Text>}
                  </>
                ) : (
                  !row.display_value && !row.thematic_note && <Text style={s.emptySlot}>Not selected</Text>
                )}
              </View>
            </View>
          );
        })}

        {safetySong?.title && (
          <View style={s.safetySection}>
            <Text style={s.safetyLabel}>Safety Song: <Text style={s.safetyText}>{safetySong.title}{safetySong.hymnal_number ? ` (${safetySong.hymnal_number})` : ""}</Text></Text>
          </View>
        )}

        {personnel.length > 0 && (
          <View style={s.personnelSection}>
            {leftPersonnel.length > 0 && (
              <View style={s.personnelCol}>
                {leftPersonnel.map((p, i) => (
                  <Text key={i} style={s.person}>
                    <Text style={s.personRole}>{p.role_label}: </Text>
                    <Text style={s.personName}>{p.person_name}</Text>
                  </Text>
                ))}
              </View>
            )}
            {rightPersonnel.length > 0 && (
              <View style={s.personnelCol}>
                {rightPersonnel.map((p, i) => (
                  <Text key={i} style={s.person}>
                    <Text style={s.personRole}>{p.role_label}: </Text>
                    <Text style={s.personName}>{p.person_name}</Text>
                  </Text>
                ))}
              </View>
            )}
          </View>
        )}

        {choirLabel && <Text style={s.choirLabel}>Choir: {choirLabel}</Text>}

        <View style={s.footer} fixed>
          <Text style={s.footerText}>St. Monica Catholic Community, Santa Monica, CA</Text>
          <Text style={s.footerText}>Generated {new Date().toLocaleDateString()}</Text>
        </View>
      </Page>
    </Document>
  );
}
