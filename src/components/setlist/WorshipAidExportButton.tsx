"use client";

import { useState } from "react";
import type { SetlistSongRow } from "@/lib/booking-types";

interface WorshipAidExportButtonProps {
  occasionName: string;
  dateDisplay: string;
  timeDisplay?: string | null;
  ensemble?: string | null;
  celebrant?: string | null;
  songs: SetlistSongRow[];
  readings?: { position: string; citation: string; synopsis?: string }[];
  season?: string;
}

export default function WorshipAidExportButton(props: WorshipAidExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const { default: WorshipAidPDF } = await import("./pdf/WorshipAidPDF");
      const blob = await pdf(WorshipAidPDF(props)).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = props.occasionName.replace(/[^a-zA-Z0-9]/g, "-");
      a.download = `${safeName}-Worship-Aid.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Worship aid PDF export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      className="print-btn no-print"
      style={{ left: "160px", right: "auto", top: "16px", position: "fixed", zIndex: 100, padding: "8px 16px", background: "#722F37", color: "white", border: "none", borderRadius: "6px", fontSize: "13px", cursor: "pointer" }}
    >
      {exporting ? "Generating..." : "Worship Aid PDF"}
    </button>
  );
}
