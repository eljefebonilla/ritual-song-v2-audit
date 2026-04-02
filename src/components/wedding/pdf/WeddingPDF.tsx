"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import { WEDDING_STEPS } from "@/lib/wedding-steps";

// Register fonts
Font.register({
  family: "Serif",
  fonts: [
    {
      src: "https://cdn.jsdelivr.net/fontsource/fonts/playfair-display@latest/latin-400-normal.ttf",
      fontWeight: 400,
    },
    {
      src: "https://cdn.jsdelivr.net/fontsource/fonts/playfair-display@latest/latin-700-normal.ttf",
      fontWeight: 700,
    },
  ],
});

Font.register({
  family: "Sans",
  fonts: [
    {
      src: "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf",
      fontWeight: 400,
    },
    {
      src: "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-600-normal.ttf",
      fontWeight: 600,
    },
  ],
});

const gold = "#B8860B";
const burgundy = "#722F37";
const charcoal = "#3C3C3C";
const muted = "#8C8C8C";

const s = StyleSheet.create({
  page: {
    paddingTop: 50,
    paddingBottom: 50,
    paddingHorizontal: 50,
    fontFamily: "Sans",
    fontSize: 10,
    color: charcoal,
  },
  // Header
  headerBar: {
    borderBottomWidth: 1.5,
    borderBottomColor: gold,
    paddingBottom: 12,
    marginBottom: 20,
  },
  eyebrow: {
    fontFamily: "Sans",
    fontSize: 8,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: muted,
    marginBottom: 4,
  },
  title: {
    fontFamily: "Serif",
    fontSize: 22,
    fontWeight: 700,
    color: charcoal,
    marginBottom: 2,
  },
  subtitle: {
    fontFamily: "Serif",
    fontSize: 12,
    color: muted,
    fontWeight: 400,
  },
  // Details grid
  detailsSection: {
    marginBottom: 20,
    backgroundColor: "#FAFAF8",
    borderRadius: 4,
    padding: 14,
  },
  detailsTitle: {
    fontFamily: "Sans",
    fontSize: 8,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: muted,
    marginBottom: 8,
    fontWeight: 600,
  },
  detailRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  detailLabel: {
    width: 100,
    fontSize: 9,
    color: muted,
  },
  detailValue: {
    flex: 1,
    fontSize: 9,
    color: charcoal,
    fontWeight: 600,
  },
  // Music selections
  sectionTitle: {
    fontFamily: "Sans",
    fontSize: 8,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: muted,
    marginBottom: 10,
    marginTop: 4,
    fontWeight: 600,
  },
  stepRow: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E8E8E8",
  },
  stepNumber: {
    width: 22,
    fontSize: 9,
    fontWeight: 600,
    color: gold,
  },
  stepContent: {
    flex: 1,
  },
  stepLabel: {
    fontSize: 8,
    color: muted,
    marginBottom: 1,
  },
  songTitle: {
    fontSize: 10,
    color: charcoal,
    fontWeight: 600,
  },
  songComposer: {
    fontSize: 8,
    color: muted,
    marginLeft: 4,
    fontWeight: 400,
  },
  notSelected: {
    fontSize: 9,
    color: "#C0C0C0",
    fontStyle: "italic",
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 30,
    left: 50,
    right: 50,
    borderTopWidth: 0.5,
    borderTopColor: "#E8E8E8",
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 7,
    color: muted,
  },
  // Notes
  notesSection: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#FAFAF8",
    borderRadius: 4,
    borderLeftWidth: 2,
    borderLeftColor: gold,
  },
  notesText: {
    fontSize: 9,
    color: charcoal,
    lineHeight: 1.5,
  },
});

interface WeddingPDFProps {
  details: {
    coupleName1: string;
    coupleName2: string;
    contactEmail: string;
    contactPhone: string;
    eventDate: string;
    eventTime: string;
    rehearsalDate: string;
    rehearsalTime: string;
    celebrant: string;
    notes: string;
  };
  selections: Record<
    number,
    { songTitle: string; composer?: string; category?: string }[]
  >;
  cantorName?: string;
  paymentAmount?: string;
}

function formatDate(d: string): string {
  if (!d) return "";
  try {
    return new Date(d + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return d;
  }
}

function formatTime(t: string): string {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

export default function WeddingPDF({
  details,
  selections,
  cantorName,
  paymentAmount,
}: WeddingPDFProps) {
  const coupleDisplay =
    details.coupleName1 && details.coupleName2
      ? `${details.coupleName1} & ${details.coupleName2}`
      : "Wedding Music Selections";

  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        {/* Header */}
        <View style={s.headerBar}>
          <Text style={s.eyebrow}>St. Monica Catholic Community</Text>
          <Text style={s.title}>{coupleDisplay}</Text>
          <Text style={s.subtitle}>Wedding Liturgy Music Selections</Text>
        </View>

        {/* Details */}
        <View style={s.detailsSection}>
          <Text style={s.detailsTitle}>Ceremony Details</Text>
          {details.eventDate && (
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Date</Text>
              <Text style={s.detailValue}>
                {formatDate(details.eventDate)}
                {details.eventTime
                  ? ` at ${formatTime(details.eventTime)}`
                  : ""}
              </Text>
            </View>
          )}
          {details.rehearsalDate && (
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Rehearsal</Text>
              <Text style={s.detailValue}>
                {formatDate(details.rehearsalDate)}
                {details.rehearsalTime
                  ? ` at ${formatTime(details.rehearsalTime)}`
                  : ""}
              </Text>
            </View>
          )}
          {details.celebrant && (
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Celebrant</Text>
              <Text style={s.detailValue}>{details.celebrant}</Text>
            </View>
          )}
          {cantorName && (
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Cantor</Text>
              <Text style={s.detailValue}>{cantorName}</Text>
            </View>
          )}
          {details.contactEmail && (
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Contact</Text>
              <Text style={s.detailValue}>
                {details.contactEmail}
                {details.contactPhone ? ` / ${details.contactPhone}` : ""}
              </Text>
            </View>
          )}
          {paymentAmount && (
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Musician Fee</Text>
              <Text style={s.detailValue}>${paymentAmount}</Text>
            </View>
          )}
        </View>

        {/* Music Selections */}
        <Text style={s.sectionTitle}>Music Selections</Text>
        {WEDDING_STEPS.map((step) => {
          const picks = selections[step.number] || [];
          return (
            <View key={step.number} style={s.stepRow} wrap={false}>
              <Text style={s.stepNumber}>{step.number}</Text>
              <View style={s.stepContent}>
                <Text style={s.stepLabel}>{step.title}</Text>
                {picks.length > 0 ? (
                  picks.map((p, i) => (
                    <Text key={i} style={s.songTitle}>
                      {p.songTitle}
                      {p.composer && (
                        <Text style={s.songComposer}> {p.composer}</Text>
                      )}
                    </Text>
                  ))
                ) : (
                  <Text style={s.notSelected}>
                    {step.isOptional ? "Skipped" : "Not selected"}
                  </Text>
                )}
              </View>
            </View>
          );
        })}

        {/* Notes */}
        {details.notes && (
          <View style={s.notesSection}>
            <Text style={s.detailsTitle}>Additional Notes</Text>
            <Text style={s.notesText}>{details.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            St. Monica Catholic Community, Santa Monica, CA
          </Text>
          <Text style={s.footerText}>
            Generated {new Date().toLocaleDateString()}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
