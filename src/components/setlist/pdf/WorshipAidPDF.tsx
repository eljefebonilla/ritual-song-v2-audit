"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { SetlistSongRow } from "@/lib/booking-types";

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
const burgundy = "#722F37";
const charcoal = "#3A3A3A";
const muted = "#888888";
const light = "#F5F3EF";

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 44, paddingHorizontal: 44, fontFamily: "Sans", fontSize: 10, color: charcoal },
  // Header
  headerBand: { backgroundColor: burgundy, paddingVertical: 14, paddingHorizontal: 20, marginHorizontal: -44, marginTop: -36, marginBottom: 16 },
  parish: { fontFamily: "Sans", fontSize: 7, letterSpacing: 2.5, textTransform: "uppercase", color: gold, marginBottom: 3 },
  title: { fontFamily: "Serif", fontSize: 20, fontWeight: 700, color: "white" },
  subtitle: { fontFamily: "Serif", fontSize: 10, color: "#D4C4A8", marginTop: 2 },
  // Section headers
  sectionTitle: { fontFamily: "Serif", fontSize: 11, fontWeight: 700, color: burgundy, marginTop: 12, marginBottom: 4, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: gold },
  // Song entry
  songEntry: { marginBottom: 6, paddingLeft: 8 },
  songLabel: { fontSize: 7, letterSpacing: 1.5, textTransform: "uppercase", color: gold, fontWeight: 600, marginBottom: 1 },
  songTitle: { fontSize: 10, fontWeight: 600, color: charcoal },
  songDetail: { fontSize: 8, color: muted, fontStyle: "italic" },
  // Reading entry
  readingEntry: { marginBottom: 6, paddingLeft: 8 },
  readingLabel: { fontSize: 7, letterSpacing: 1.5, textTransform: "uppercase", color: gold, fontWeight: 600, marginBottom: 1 },
  readingText: { fontSize: 9, color: charcoal, lineHeight: 1.4 },
  // Response (assembly part)
  responseBox: { backgroundColor: light, borderRadius: 3, paddingVertical: 4, paddingHorizontal: 8, marginVertical: 4 },
  responseLabel: { fontSize: 7, color: burgundy, fontWeight: 600, marginBottom: 1 },
  responseText: { fontFamily: "Serif", fontSize: 10, fontWeight: 700, color: charcoal },
  // Footer
  footer: { position: "absolute", bottom: 24, left: 44, right: 44, borderTopWidth: 0.5, borderTopColor: gold, paddingTop: 6, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 6, color: muted },
});

interface WorshipAidProps {
  occasionName: string;
  dateDisplay: string;
  timeDisplay?: string | null;
  ensemble?: string | null;
  celebrant?: string | null;
  songs: SetlistSongRow[];
  readings?: { position: string; citation: string; synopsis?: string }[];
  season?: string;
}

// Standard Order of Mass sections
const MASS_ORDER = [
  { key: "prelude", label: "Prelude", type: "song" },
  { key: "gathering", label: "Introductory Rites", type: "song" },
  { key: "penitentialAct", label: "Penitential Act", type: "song" },
  { key: "gloria", label: "Gloria", type: "song" },
  { key: "first_reading", label: "First Reading", type: "reading" },
  { key: "psalm", label: "Responsorial Psalm", type: "song" },
  { key: "second_reading", label: "Second Reading", type: "reading" },
  { key: "gospelAcclamation", label: "Gospel Acclamation", type: "song" },
  { key: "gospel", label: "Gospel", type: "reading" },
  { key: "offertory", label: "Preparation of the Gifts", type: "song" },
  { key: "communion1", label: "Communion", type: "song" },
  { key: "communion2", label: "Communion II", type: "song" },
  { key: "meditation", label: "Meditation", type: "song" },
  { key: "sending", label: "Sending Forth", type: "song" },
];

export default function WorshipAidPDF({
  occasionName,
  dateDisplay,
  timeDisplay,
  ensemble,
  celebrant,
  songs,
  readings = [],
  season,
}: WorshipAidProps) {
  const songMap = new Map<string, SetlistSongRow>();
  for (const row of songs) {
    songMap.set(row.position, row);
  }

  const readingMap = new Map<string, { citation: string; synopsis?: string }>();
  for (const r of readings) {
    readingMap.set(r.position, r);
  }

  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        {/* Burgundy header band */}
        <View style={s.headerBand}>
          <Text style={s.parish}>St. Monica Catholic Community</Text>
          <Text style={s.title}>{occasionName}</Text>
          <Text style={s.subtitle}>
            {dateDisplay}
            {timeDisplay ? ` \u2014 ${timeDisplay}` : ""}
            {ensemble ? ` \u2014 ${ensemble}` : ""}
            {celebrant ? ` \u2014 ${celebrant}` : ""}
          </Text>
        </View>

        {/* Order of Mass */}
        {MASS_ORDER.map((section) => {
          const songRow = songMap.get(section.key);
          const reading = readingMap.get(section.key);

          // Skip empty sections
          if (section.type === "song" && !songRow) return null;
          if (section.type === "reading" && !reading) return null;

          if (section.type === "reading" && reading) {
            return (
              <View key={section.key} style={s.readingEntry} wrap={false}>
                <Text style={s.readingLabel}>{section.label}</Text>
                <Text style={s.readingText}>{reading.citation}</Text>
                {reading.synopsis && (
                  <Text style={{ ...s.readingText, fontStyle: "italic", color: muted, marginTop: 2 }}>
                    {reading.synopsis}
                  </Text>
                )}
              </View>
            );
          }

          if (section.type === "song" && songRow) {
            const song = songRow.songs?.[0];
            // Psalm gets a response box
            if (section.key === "psalm" && songRow.thematic_note) {
              return (
                <View key={section.key} wrap={false}>
                  <View style={s.songEntry}>
                    <Text style={s.songLabel}>{section.label}</Text>
                    {song && <Text style={s.songTitle}>{song.title}</Text>}
                  </View>
                  <View style={s.responseBox}>
                    <Text style={s.responseLabel}>Response</Text>
                    <Text style={s.responseText}>{songRow.thematic_note}</Text>
                  </View>
                </View>
              );
            }

            return (
              <View key={section.key} style={s.songEntry} wrap={false}>
                <Text style={s.songLabel}>{section.label}</Text>
                {songRow.display_value ? (
                  <Text style={s.songDetail}>{songRow.display_value}</Text>
                ) : song ? (
                  <>
                    <Text style={s.songTitle}>{song.title}</Text>
                    {song.hymnal_number && <Text style={s.songDetail}>{song.hymnal_number}</Text>}
                  </>
                ) : (
                  <Text style={s.songDetail}>{songRow.thematic_note || ""}</Text>
                )}
              </View>
            );
          }

          return null;
        })}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>St. Monica Catholic Community, Santa Monica, CA</Text>
          <Text style={s.footerText}>Worship Aid \u2014 Generated {new Date().toLocaleDateString()}</Text>
        </View>
      </Page>
    </Document>
  );
}
