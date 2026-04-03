"use client";

import { useState } from "react";
import type { SetlistSongRow, SetlistPersonnel, SetlistSafetySong } from "@/lib/booking-types";

interface SetlistExportButtonProps {
  occasionName: string;
  specialDesignation?: string | null;
  dateDisplay: string;
  timeDisplay?: string | null;
  ensemble?: string | null;
  songs: SetlistSongRow[];
  personnel: SetlistPersonnel[];
  choirLabel?: string | null;
  safetySong?: SetlistSafetySong | null;
}

export default function SetlistExportButton(props: SetlistExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const { default: SetlistPDF } = await import("./pdf/SetlistPDF");
      const blob = await pdf(SetlistPDF(props)).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = props.occasionName.replace(/[^a-zA-Z0-9]/g, "-");
      a.download = `${safeName}-Setlist.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Setlist PDF export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      className="print-btn no-print"
      style={{ left: "16px", right: "auto", top: "16px", position: "fixed", zIndex: 100, padding: "8px 16px", background: "#B8A472", color: "white", border: "none", borderRadius: "6px", fontSize: "13px", cursor: "pointer" }}
    >
      {exporting ? "Generating..." : "Download PDF"}
    </button>
  );
}
