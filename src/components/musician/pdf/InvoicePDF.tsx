"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { InvoiceData } from "@/tools/invoice/types";

// Register fonts (same as WeddingPDF)
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
const charcoal = "#3C3C3C";
const muted = "#8C8C8C";

const s = StyleSheet.create({
  page: {
    paddingTop: 50,
    paddingBottom: 60,
    paddingHorizontal: 50,
    fontFamily: "Sans",
    fontSize: 10,
    color: charcoal,
  },
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
    width: 120,
    fontSize: 9,
    color: muted,
  },
  detailValue: {
    flex: 1,
    fontSize: 9,
    color: charcoal,
    fontWeight: 600,
  },
  // Table
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: gold,
    paddingBottom: 4,
    marginBottom: 4,
  },
  tableHeaderText: {
    fontSize: 7,
    fontWeight: 600,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: muted,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E8E8E8",
  },
  colDate: { width: 75 },
  colTime: { width: 50 },
  colDescription: { flex: 1 },
  colRole: { width: 80 },
  colAmount: { width: 60, textAlign: "right" },
  cellText: { fontSize: 9, color: charcoal },
  cellMuted: { fontSize: 9, color: muted },
  // Totals
  totalsSection: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1.5,
    borderTopColor: gold,
    alignItems: "flex-end",
  },
  totalRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  totalLabel: {
    width: 140,
    fontSize: 10,
    color: muted,
    textAlign: "right",
    paddingRight: 12,
  },
  totalValue: {
    width: 80,
    fontSize: 12,
    fontWeight: 600,
    color: charcoal,
    textAlign: "right",
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
});

function formatDate(d: string): string {
  if (!d) return "";
  try {
    return new Date(d + "T12:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

function formatCurrency(n: number): string {
  return `$${n.toFixed(2)}`;
}

interface InvoicePDFProps {
  data: InvoiceData;
}

export default function InvoicePDF({ data }: InvoicePDFProps) {
  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        {/* Header */}
        <View style={s.headerBar}>
          <Text style={s.eyebrow}>St. Monica Catholic Community</Text>
          <Text style={s.title}>Musician Invoice</Text>
          <Text style={s.subtitle}>{data.musicianName}</Text>
        </View>

        {/* Details */}
        <View style={s.detailsSection}>
          <Text style={s.detailsTitle}>Invoice Details</Text>
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Musician</Text>
            <Text style={s.detailValue}>{data.musicianName}</Text>
          </View>
          {data.musicianEmail && (
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Contact</Text>
              <Text style={s.detailValue}>
                {data.musicianEmail}
                {data.musicianPhone ? ` / ${data.musicianPhone}` : ""}
              </Text>
            </View>
          )}
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Period</Text>
            <Text style={s.detailValue}>
              {formatDate(data.periodFrom)} — {formatDate(data.periodTo)}
            </Text>
          </View>
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Rate per Mass</Text>
            <Text style={s.detailValue}>{formatCurrency(data.payRatePerMass)}</Text>
          </View>
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Total Services</Text>
            <Text style={s.detailValue}>{data.lineItems.length}</Text>
          </View>
        </View>

        {/* Line items table */}
        <Text style={s.detailsTitle}>Service History</Text>
        <View style={s.tableHeader}>
          <View style={s.colDate}>
            <Text style={s.tableHeaderText}>Date</Text>
          </View>
          <View style={s.colTime}>
            <Text style={s.tableHeaderText}>Time</Text>
          </View>
          <View style={s.colDescription}>
            <Text style={s.tableHeaderText}>Description</Text>
          </View>
          <View style={s.colRole}>
            <Text style={s.tableHeaderText}>Role</Text>
          </View>
          <View style={s.colAmount}>
            <Text style={s.tableHeaderText}>Amount</Text>
          </View>
        </View>

        {data.lineItems.map((item, i) => (
          <View key={i} style={s.tableRow} wrap={false}>
            <View style={s.colDate}>
              <Text style={s.cellText}>{formatDate(item.date)}</Text>
            </View>
            <View style={s.colTime}>
              <Text style={s.cellMuted}>{item.time || ""}</Text>
            </View>
            <View style={s.colDescription}>
              <Text style={s.cellText}>{item.description}</Text>
            </View>
            <View style={s.colRole}>
              <Text style={s.cellMuted}>{item.role}</Text>
            </View>
            <View style={s.colAmount}>
              <Text style={s.cellText}>{formatCurrency(item.rate)}</Text>
            </View>
          </View>
        ))}

        {/* Totals */}
        <View style={s.totalsSection}>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>
              {data.lineItems.length} service{data.lineItems.length !== 1 ? "s" : ""} x{" "}
              {formatCurrency(data.payRatePerMass)}
            </Text>
            <Text style={s.totalValue}>{formatCurrency(data.subtotal)}</Text>
          </View>
        </View>

        {/* Payment notes */}
        {data.paymentNotes && (
          <View style={s.notesSection}>
            <Text style={s.detailsTitle}>Payment Notes</Text>
            <Text style={s.notesText}>{data.paymentNotes}</Text>
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
