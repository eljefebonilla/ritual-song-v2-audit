"use client";

import type { FoldFormat } from "@/imposition/types";

interface ImpositionPreviewProps {
  format: FoldFormat | "FLAT";
  pageCount: number;
}

/**
 * Visual diagram showing how pages map to the printed sheet.
 * Renders an inline SVG with labeled panels.
 */
export function ImpositionPreview({ format, pageCount }: ImpositionPreviewProps) {
  if (format === "FLAT" || pageCount === 0) {
    return (
      <div className="text-[10px] text-stone-400 italic">
        Flat: pages printed in order, one per sheet.
      </div>
    );
  }

  const layout = getLayout(format, pageCount);

  return (
    <div className="flex flex-col gap-1">
      <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">
        {layout.label}
      </p>
      <div className="flex gap-3 items-start">
        <SheetDiagram side="Front" panels={layout.front} width={layout.svgWidth} height={layout.svgHeight} folds={layout.folds} />
        <SheetDiagram side="Back" panels={layout.back} width={layout.svgWidth} height={layout.svgHeight} folds={layout.folds} />
      </div>
      <p className="text-[9px] text-stone-400">
        {layout.sheets} sheet{layout.sheets !== 1 ? "s" : ""} total
        {layout.blanks > 0 ? ` (${layout.blanks} blank page${layout.blanks !== 1 ? "s" : ""} auto-inserted)` : ""}
      </p>
    </div>
  );
}

interface Panel {
  x: number; // 0-1 fraction
  width: number; // 0-1 fraction
  label: string;
}

interface SheetLayout {
  label: string;
  svgWidth: number;
  svgHeight: number;
  front: Panel[];
  back: Panel[];
  folds: number[]; // x fractions where fold lines go
  sheets: number;
  blanks: number;
}

function padTo(n: number, mult: number): number {
  const r = n % mult;
  return r === 0 ? n : n + (mult - r);
}

function getLayout(format: FoldFormat, pageCount: number): SheetLayout {
  switch (format) {
    case "HALF_LETTER_SADDLE_STITCH": {
      const padded = padTo(pageCount, 4);
      const sheets = padded / 4;
      const blanks = padded - pageCount;
      // Show the outermost sheet
      return {
        label: `Half-Letter Saddle-Stitch (${padded} pages)`,
        svgWidth: 140, svgHeight: 50,
        front: [
          { x: 0, width: 0.5, label: `p${padded}` },
          { x: 0.5, width: 0.5, label: "p1" },
        ],
        back: [
          { x: 0, width: 0.5, label: "p2" },
          { x: 0.5, width: 0.5, label: `p${padded - 1}` },
        ],
        folds: [0.5],
        sheets,
        blanks,
      };
    }
    case "LETTER_BIFOLD": {
      const padded = padTo(pageCount, 4);
      const blanks = padded - pageCount;
      return {
        label: "Letter Bi-fold (4-panel)",
        svgWidth: 140, svgHeight: 50,
        front: [
          { x: 0, width: 0.5, label: "p4" },
          { x: 0.5, width: 0.5, label: "p1" },
        ],
        back: [
          { x: 0, width: 0.5, label: "p2" },
          { x: 0.5, width: 0.5, label: "p3" },
        ],
        folds: [0.5],
        sheets: padded / 4,
        blanks,
      };
    }
    case "LEGAL_BIFOLD": {
      const padded = padTo(pageCount, 4);
      const blanks = padded - pageCount;
      return {
        label: "Legal Bi-fold (7\" x 8.5\" finished)",
        svgWidth: 140, svgHeight: 50,
        front: [
          { x: 0, width: 0.5, label: "p4" },
          { x: 0.5, width: 0.5, label: "p1" },
        ],
        back: [
          { x: 0, width: 0.5, label: "p2" },
          { x: 0.5, width: 0.5, label: "p3" },
        ],
        folds: [0.5],
        sheets: padded / 4,
        blanks,
      };
    }
    case "TABLOID_TRIFOLD": {
      const padded = padTo(pageCount, 6);
      const blanks = padded - pageCount;
      const flapW = 1 / 3 - 0.01; // inside flap slightly narrower
      const otherW = (1 - flapW) / 2;
      return {
        label: "Tabloid Tri-fold (6-panel)",
        svgWidth: 180, svgHeight: 50,
        front: [
          { x: 0, width: otherW, label: "p6" },
          { x: otherW, width: otherW, label: "p1" },
          { x: otherW * 2, width: flapW, label: "p2" },
        ],
        back: [
          { x: 0, width: flapW, label: "p3" },
          { x: flapW, width: otherW, label: "p4" },
          { x: flapW + otherW, width: otherW, label: "p5" },
        ],
        folds: [otherW, otherW * 2],
        sheets: padded / 6,
        blanks,
      };
    }
  }
}

function SheetDiagram({ side, panels, width, height, folds }: {
  side: string;
  panels: Panel[];
  width: number;
  height: number;
  folds: number[];
}) {
  const PAD = 2;
  const innerW = width - PAD * 2;
  const innerH = height - 14; // room for label

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[9px] text-stone-400">{side}</span>
      <svg width={width} height={height} className="block">
        {/* Sheet outline */}
        <rect x={PAD} y={0} width={innerW} height={innerH} fill="#fafaf9" stroke="#d6d3d1" strokeWidth={1} rx={2} />

        {/* Panels */}
        {panels.map((p, i) => {
          const px = PAD + p.x * innerW;
          const pw = p.width * innerW;
          const isBlank = p.label.includes("blank");
          return (
            <g key={i}>
              <rect x={px + 1} y={1} width={pw - 2} height={innerH - 2} fill={isBlank ? "#f5f5f4" : "#e7e5e4"} rx={1} />
              <text x={px + pw / 2} y={innerH / 2 + 1} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill={isBlank ? "#a8a29e" : "#57534E"} fontFamily="system-ui">
                {p.label}
              </text>
            </g>
          );
        })}

        {/* Fold lines */}
        {folds.map((f, i) => {
          const fx = PAD + f * innerW;
          return (
            <line key={`fold-${i}`} x1={fx} y1={0} x2={fx} y2={innerH} stroke="#ef4444" strokeWidth={1} strokeDasharray="3,2" opacity={0.6} />
          );
        })}
      </svg>
    </div>
  );
}
