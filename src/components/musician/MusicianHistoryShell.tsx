"use client";

import { useState, useEffect, useCallback } from "react";
import type { HistoryEntry, InvoiceData } from "@/tools/invoice/types";

interface MusicianHistoryShellProps {
  profileId: string;
  musicianName: string;
  isAdmin?: boolean;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  mass: "Mass",
  school: "School Mass",
  sacrament: "Sacramental",
  holy_day: "Holy Day",
  wedding: "Wedding",
  funeral: "Funeral",
  special: "Special",
};

function formatDate(d: string): string {
  try {
    return new Date(d + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

export default function MusicianHistoryShell({
  profileId,
  musicianName,
  isAdmin = false,
}: MusicianHistoryShellProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Filters
  const now = new Date();
  const yearStart = `${now.getFullYear()}-01-01`;
  const today = now.toISOString().split("T")[0];
  const [from, setFrom] = useState(yearStart);
  const [to, setTo] = useState(today);
  const [ensemble, setEnsemble] = useState("");
  const [eventType, setEventType] = useState("");

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ profileId });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (ensemble) params.set("ensemble", ensemble);
      if (eventType) params.set("eventType", eventType);

      const res = await fetch(`/api/musician/history?${params}`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    } finally {
      setLoading(false);
    }
  }, [profileId, from, to, ensemble, eventType]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleExportInvoice = useCallback(async () => {
    setExporting(true);
    try {
      // Get invoice data
      const res = await fetch("/api/musician/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, from, to }),
      });

      if (!res.ok) {
        alert("Failed to generate invoice");
        return;
      }

      const invoiceData: InvoiceData = await res.json();

      // Dynamic import for PDF generation
      const { pdf } = await import("@react-pdf/renderer");
      const { default: InvoicePDF } = await import("./pdf/InvoicePDF");
      const blob = await pdf(InvoicePDF({ data: invoiceData })).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = musicianName.replace(/\s+/g, "-");
      a.download = `${safeName}-Invoice-${from}-to-${to}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Invoice export failed:", err);
    } finally {
      setExporting(false);
    }
  }, [profileId, from, to, musicianName]);

  // Derive unique ensembles from data for filter
  const ensembles = [...new Set(history.map((h) => h.ensemble).filter(Boolean))] as string[];
  const totalMasses = history.length;

  const inputClass =
    "px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-parish-gold/50 focus:border-parish-gold";

  return (
    <div className="max-w-5xl mx-auto pb-16">
      {/* Hero header */}
      <div
        className="px-6 pt-8 pb-6"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, color-mix(in srgb, var(--color-parish-gold), transparent 85%), var(--color-background))",
        }}
      >
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted font-medium mb-2">
          Musician Portal
        </p>
        <h1 className="font-serif text-[1.75rem] font-light text-parish-charcoal mb-1">
          {musicianName}
        </h1>
        <p className="text-sm text-muted">
          Service history and invoice generation
        </p>
      </div>

      {/* Stats cards */}
      <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-stone-200 p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted font-medium">Total Services</p>
          <p className="text-2xl font-bold text-parish-charcoal">{totalMasses}</p>
        </div>
        <div className="bg-white rounded-lg border border-stone-200 p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted font-medium">Ensembles</p>
          <p className="text-2xl font-bold text-parish-charcoal">{ensembles.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-stone-200 p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted font-medium">Period</p>
          <p className="text-sm font-medium text-parish-charcoal mt-1">
            {from ? new Date(from + "T12:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "All"}
            {" — "}
            {to ? new Date(to + "T12:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "Now"}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-stone-200 p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted font-medium">Roles</p>
          <p className="text-sm font-medium text-parish-charcoal mt-1">
            {[...new Set(history.map((h) => h.roleName))].slice(0, 3).join(", ")}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 flex flex-wrap gap-3 items-end border-b border-border">
        <div>
          <label className="block text-[10px] font-medium text-stone-500 mb-1">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-stone-500 mb-1">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
        </div>
        {ensembles.length > 1 && (
          <div>
            <label className="block text-[10px] font-medium text-stone-500 mb-1">Ensemble</label>
            <select value={ensemble} onChange={(e) => setEnsemble(e.target.value)} className={inputClass}>
              <option value="">All</option>
              {ensembles.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-[10px] font-medium text-stone-500 mb-1">Type</label>
          <select value={eventType} onChange={(e) => setEventType(e.target.value)} className={inputClass}>
            <option value="">All</option>
            {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleExportInvoice}
          disabled={exporting || history.length === 0}
          className="px-4 py-1.5 rounded-lg bg-parish-burgundy text-white font-medium text-sm hover:bg-parish-burgundy/90 transition-colors disabled:opacity-50 ml-auto"
        >
          {exporting ? "Generating..." : "Generate Invoice PDF"}
        </button>
      </div>

      {/* History table */}
      <div className="px-6 py-4">
        {loading ? (
          <p className="text-sm text-muted py-8 text-center">Loading history...</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-muted py-8 text-center">
            No booking history found for this period.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200">
                  <th className="text-left px-2 py-2 text-[10px] font-semibold text-stone-500 uppercase tracking-wide">Date</th>
                  <th className="text-left px-2 py-2 text-[10px] font-semibold text-stone-500 uppercase tracking-wide">Time</th>
                  <th className="text-left px-2 py-2 text-[10px] font-semibold text-stone-500 uppercase tracking-wide">Celebration</th>
                  <th className="text-left px-2 py-2 text-[10px] font-semibold text-stone-500 uppercase tracking-wide">Ensemble</th>
                  <th className="text-left px-2 py-2 text-[10px] font-semibold text-stone-500 uppercase tracking-wide">Role</th>
                  <th className="text-left px-2 py-2 text-[10px] font-semibold text-stone-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.slotId} className="border-b border-stone-100 hover:bg-stone-50/50">
                    <td className="px-2 py-2 text-stone-900 font-medium whitespace-nowrap">
                      {formatDate(entry.eventDate)}
                    </td>
                    <td className="px-2 py-2 text-stone-500 whitespace-nowrap">
                      {entry.startTime12h || "—"}
                    </td>
                    <td className="px-2 py-2 text-stone-700">
                      {entry.liturgicalName || EVENT_TYPE_LABELS[entry.eventType] || entry.eventType}
                    </td>
                    <td className="px-2 py-2 text-stone-500">{entry.ensemble || "—"}</td>
                    <td className="px-2 py-2 text-stone-700">
                      {entry.roleLabelOverride || entry.roleName}
                      {entry.instrumentDetail && (
                        <span className="text-stone-400 ml-1">({entry.instrumentDetail})</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          entry.confirmation === "confirmed"
                            ? "bg-green-50 text-green-700"
                            : entry.confirmation === "expected"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-stone-100 text-stone-500"
                        }`}
                      >
                        {entry.confirmation}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
