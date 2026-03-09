"use client";

import { useState, useMemo, useCallback } from "react";
import type { LibrarySong } from "@/lib/types";
import {
  buildExplorerGraph,
  type ExplorerNode,
} from "@/lib/song-explorer";

interface SongExplorerProps {
  dateStr: string;
  songs: LibrarySong[];
  season: string;
  targetFunction?: string;
  onSelectSong?: (songId: string) => void;
  onClose: () => void;
}

// --- Layout constants ---
const SVG_SIZE = 580;
const CX = SVG_SIZE / 2;
const CY = SVG_SIZE / 2;
const READING_RADIUS = 60; // inner ring
const THEME_RADIUS = 155; // middle ring
const SONG_RADIUS = 265; // outer ring

// --- Colors ---
const AMBER_700 = "#a16207";
const AMBER_800 = "#92400e";
const STONE_300 = "#d6d3d1";
const STONE_400 = "#a8a29e";
const STONE_500 = "#78716c";
const STONE_900 = "#1c1917";

/** Place items in a circle around center */
function radialPosition(
  index: number,
  total: number,
  radius: number,
  offsetAngle = -Math.PI / 2 // start from top
): { x: number; y: number } {
  const angle = offsetAngle + (2 * Math.PI * index) / total;
  return {
    x: CX + radius * Math.cos(angle),
    y: CY + radius * Math.sin(angle),
  };
}

/** Curved connection line between two points */
function Connection({
  x1, y1, x2, y2,
  active = false,
  scripture = false,
}: {
  x1: number; y1: number; x2: number; y2: number;
  active?: boolean;
  scripture?: boolean;
}) {
  // Curve toward center for organic feel
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  // Pull control point toward center
  const pullX = (CX - mx) * 0.15;
  const pullY = (CY - my) * 0.15;
  const cpx = mx + pullX;
  const cpy = my + pullY;

  const strokeColor = scripture ? AMBER_700 : active ? AMBER_700 : STONE_300;
  const opacity = active || scripture ? 0.7 : 0.2;
  const width = active || scripture ? 1.5 : 0.8;

  return (
    <path
      d={`M ${x1} ${y1} Q ${cpx} ${cpy} ${x2} ${y2}`}
      fill="none"
      stroke={strokeColor}
      strokeWidth={width}
      strokeOpacity={opacity}
      className="transition-all duration-300"
    />
  );
}

export default function SongExplorer({
  dateStr,
  songs,
  season,
  targetFunction,
  onSelectSong,
  onClose,
}: SongExplorerProps) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [activeTheme, setActiveTheme] = useState<string | null>(null);

  const graph = useMemo(
    () => buildExplorerGraph(dateStr, songs, season, targetFunction, 5),
    [dateStr, songs, season, targetFunction]
  );

  const handleThemeClick = useCallback((themeId: string) => {
    setActiveTheme((prev) => (prev === themeId ? null : themeId));
  }, []);

  const handleSongClick = useCallback(
    (songId: string) => {
      onSelectSong?.(songId);
    },
    [onSelectSong]
  );

  // --- Radial positions ---
  const readingPositions = useMemo(() => {
    return graph.readingNodes.map((node, i) => ({
      node,
      ...radialPosition(i, graph.readingNodes.length, READING_RADIUS),
    }));
  }, [graph.readingNodes]);

  const themePositions = useMemo(() => {
    return graph.themeNodes.map((node, i) => ({
      node,
      ...radialPosition(i, graph.themeNodes.length, THEME_RADIUS),
    }));
  }, [graph.themeNodes]);

  // Filter songs based on active theme
  const visibleSongs = useMemo(() => {
    if (!activeTheme) {
      return graph.songNodes.slice(0, 16);
    }
    const connectedIds = new Set(
      graph.edges
        .filter((e) => e.from === activeTheme)
        .map((e) => e.to)
    );
    const connected = graph.songNodes.filter((n) => connectedIds.has(n.id));
    const scriptureMatches = graph.songNodes.filter(
      (n) => n.reasons?.some((r) => r.startsWith("Scripture:")) && !connectedIds.has(n.id)
    );
    return [...connected, ...scriptureMatches].slice(0, 16);
  }, [graph, activeTheme]);

  const songPositions = useMemo(() => {
    return visibleSongs.map((node, i) => ({
      node,
      ...radialPosition(i, visibleSongs.length, SONG_RADIUS),
    }));
  }, [visibleSongs]);

  // Song counts per theme
  const themeSongCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const edge of graph.edges) {
      if (edge.from.startsWith("t-") && edge.to.startsWith("s-")) {
        counts[edge.from] = (counts[edge.from] || 0) + 1;
      }
    }
    return counts;
  }, [graph.edges]);

  // Active edges
  const activeEdgeKeys = useMemo(() => {
    const active = new Set<string>();
    if (hoveredNode || activeTheme) {
      const target = hoveredNode || activeTheme;
      for (const edge of graph.edges) {
        if (edge.from === target || edge.to === target) {
          active.add(`${edge.from}->${edge.to}`);
        }
      }
    }
    return active;
  }, [hoveredNode, activeTheme, graph.edges]);

  // Build position lookup maps
  const posMap = useMemo(() => {
    const m: Record<string, { x: number; y: number }> = {};
    for (const p of readingPositions) m[p.node.id] = { x: p.x, y: p.y };
    for (const p of themePositions) m[p.node.id] = { x: p.x, y: p.y };
    for (const p of songPositions) m[p.node.id] = { x: p.x, y: p.y };
    return m;
  }, [readingPositions, themePositions, songPositions]);

  if (graph.readingNodes.length === 0) {
    return (
      <div className="bg-stone-50 rounded-lg p-6 text-center">
        <p className="text-sm text-stone-400">No readings found for this date.</p>
        <button onClick={onClose} className="mt-2 text-xs text-stone-500 hover:text-stone-700">
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-stone-200 rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-stone-50 border-b border-stone-200">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={AMBER_800} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
            <path d="M2 12h20" />
          </svg>
          <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">
            Song Explorer
          </span>
          {targetFunction && (
            <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
              {targetFunction}
            </span>
          )}
        </div>
        <button onClick={onClose} className="p-1 hover:bg-stone-200 rounded transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-stone-400">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>

      {/* Radial Constellation */}
      <div className="flex justify-center overflow-x-auto bg-stone-50/30">
        <svg
          width={SVG_SIZE}
          height={SVG_SIZE}
          viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
          className="select-none"
        >
          <defs>
            <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={AMBER_700} stopOpacity="0.06" />
              <stop offset="70%" stopColor={AMBER_700} stopOpacity="0.02" />
              <stop offset="100%" stopColor={AMBER_700} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Ambient glow */}
          <circle cx={CX} cy={CY} r={THEME_RADIUS + 20} fill="url(#centerGlow)" />

          {/* Orbit rings (subtle) */}
          <circle cx={CX} cy={CY} r={READING_RADIUS} fill="none" stroke={STONE_300} strokeWidth="0.5" strokeOpacity="0.3" strokeDasharray="2 4" />
          <circle cx={CX} cy={CY} r={THEME_RADIUS} fill="none" stroke={STONE_300} strokeWidth="0.5" strokeOpacity="0.2" strokeDasharray="2 4" />

          {/* --- Connection lines --- */}
          {/* Reading → Theme */}
          {graph.edges
            .filter((e) => e.from.startsWith("r-") && e.to.startsWith("t-"))
            .map((edge) => {
              const from = posMap[edge.from];
              const to = posMap[edge.to];
              if (!from || !to) return null;
              return (
                <Connection
                  key={`${edge.from}-${edge.to}`}
                  x1={from.x} y1={from.y}
                  x2={to.x} y2={to.y}
                  active={activeEdgeKeys.has(`${edge.from}->${edge.to}`)}
                />
              );
            })}

          {/* Theme → Song */}
          {graph.edges
            .filter((e) => e.to.startsWith("s-") && posMap[e.from] && posMap[e.to])
            .map((edge) => {
              const from = posMap[edge.from];
              const to = posMap[edge.to];
              if (!from || !to) return null;
              const isScripture = edge.from.startsWith("r-");
              return (
                <Connection
                  key={`${edge.from}-${edge.to}`}
                  x1={from.x} y1={from.y}
                  x2={to.x} y2={to.y}
                  active={activeEdgeKeys.has(`${edge.from}->${edge.to}`)}
                  scripture={isScripture}
                />
              );
            })}

          {/* --- Center: Date label --- */}
          <text x={CX} y={CY - 4} textAnchor="middle" fontSize="11" fontWeight="700" fill={STONE_500}>
            {dateStr}
          </text>
          <text x={CX} y={CY + 10} textAnchor="middle" fontSize="8" fill={STONE_400}>
            {graph.songNodes.length} songs
          </text>

          {/* --- Reading nodes (inner ring) --- */}
          {readingPositions.map(({ node, x, y }) => {
            const isHovered = hoveredNode === node.id;
            const r = isHovered ? 8 : 6;
            return (
              <g
                key={node.id}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                className="cursor-pointer"
              >
                {/* Glow ring on hover */}
                {isHovered && (
                  <circle cx={x} cy={y} r={r + 4} fill={AMBER_700} fillOpacity="0.08" />
                )}
                <circle cx={x} cy={y} r={r} fill="white" stroke={AMBER_800} strokeWidth={isHovered ? 2 : 1.5} />
                {/* Sublabel */}
                <text
                  x={x}
                  y={y - r - 6}
                  textAnchor="middle"
                  fontSize="7"
                  fontWeight="600"
                  fill={STONE_400}
                >
                  {node.sublabel}
                </text>
                {/* Citation */}
                <text
                  x={x}
                  y={y - r - 16}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="700"
                  fill={AMBER_800}
                >
                  {node.label.length > 18 ? node.label.slice(0, 16) + "..." : node.label}
                </text>
              </g>
            );
          })}

          {/* --- Theme nodes (middle ring) --- */}
          {themePositions.map(({ node, x, y }) => {
            const isHovered = hoveredNode === node.id;
            const isActive = activeTheme === node.id;
            const r = isActive ? 24 : isHovered ? 22 : 18;
            const count = themeSongCounts[node.id] || 0;

            return (
              <g
                key={node.id}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => handleThemeClick(node.id)}
                className="cursor-pointer"
              >
                {/* Hover/active glow */}
                {(isHovered || isActive) && (
                  <circle cx={x} cy={y} r={r + 6} fill={AMBER_700} fillOpacity="0.06" />
                )}
                {/* Outer ring */}
                <circle
                  cx={x} cy={y} r={r + 2}
                  fill="none"
                  stroke={isActive ? AMBER_700 : isHovered ? STONE_500 : "transparent"}
                  strokeWidth="1"
                  strokeOpacity="0.4"
                />
                {/* Main circle */}
                <circle
                  cx={x} cy={y} r={r}
                  fill={isActive ? "#fef3c7" : "white"}
                  stroke={isActive ? AMBER_700 : STONE_300}
                  strokeWidth={isActive ? 1.5 : 1}
                />
                {/* Label */}
                <text
                  x={x} y={y - 2}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight={isActive ? "700" : "600"}
                  fill={isActive ? AMBER_700 : STONE_500}
                >
                  {node.label}
                </text>
                {/* Count */}
                <text
                  x={x} y={y + 9}
                  textAnchor="middle"
                  fontSize="7"
                  fill={isActive ? AMBER_800 : STONE_400}
                >
                  {count}
                </text>
              </g>
            );
          })}

          {/* --- Song nodes (outer ring) --- */}
          {songPositions.map(({ node, x, y }) => {
            const isHovered = hoveredNode === node.id;
            const isScripture = !!node.reasons?.some((r) => r.startsWith("Scripture:"));
            // Determine label anchor based on position
            const angle = Math.atan2(y - CY, x - CX);
            const isRight = Math.abs(angle) < Math.PI / 2;
            const labelX = isRight ? x + 10 : x - 10;
            const anchor = isRight ? "start" : "end";
            // Truncate long titles
            const maxLen = 28;
            const title = node.label.length > maxLen
              ? node.label.slice(0, maxLen - 2) + "..."
              : node.label;

            return (
              <g
                key={node.id}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => node.songId && handleSongClick(node.songId)}
                className="cursor-pointer"
              >
                {/* Hover glow */}
                {isHovered && (
                  <circle cx={x} cy={y} r={10} fill={AMBER_700} fillOpacity="0.08" />
                )}
                {/* Scripture highlight background */}
                {isScripture && (
                  <circle cx={x} cy={y} r={7} fill="#fef3c7" stroke="#fcd34d" strokeWidth="0.5" />
                )}
                {/* Dot */}
                <circle
                  cx={x} cy={y}
                  r={isScripture ? 5 : isHovered ? 4 : 3}
                  fill={isScripture ? AMBER_700 : isHovered ? STONE_500 : STONE_400}
                />
                {/* Title */}
                <text
                  x={labelX} y={y - 3}
                  textAnchor={anchor}
                  fontSize="9"
                  fontWeight={isScripture || isHovered ? "600" : "500"}
                  fill={isHovered ? STONE_900 : isScripture ? AMBER_800 : STONE_500}
                >
                  {title}
                </text>
                {/* Composer + usage */}
                <text
                  x={labelX} y={y + 7}
                  textAnchor={anchor}
                  fontSize="7"
                  fill={STONE_400}
                >
                  {node.sublabel ? (node.sublabel.length > 20 ? node.sublabel.slice(0, 18) + "..." : node.sublabel) : ""}
                  {node.usageCount ? ` · ${node.usageCount}x` : ""}
                </text>
                {/* Scripture ref badge */}
                {isScripture && node.reasons && node.reasons.length > 0 && (
                  <text
                    x={labelX} y={y + 16}
                    textAnchor={anchor}
                    fontSize="7"
                    fontWeight="600"
                    fill={AMBER_700}
                  >
                    {node.reasons[0]}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-stone-50 border-t border-stone-100 flex items-center justify-between">
        <p className="text-[10px] text-stone-400">
          {graph.songNodes.length} songs found · Click themes to filter · Click songs to select
        </p>
        {activeTheme && (
          <button
            onClick={() => setActiveTheme(null)}
            className="text-[10px] text-amber-700 hover:text-amber-900 transition-colors"
          >
            Show all
          </button>
        )}
      </div>
    </div>
  );
}
