"use client";

import { useState, useMemo, useCallback } from "react";
import type { LibrarySong } from "@/lib/types";
import {
  buildExplorerGraph,
  type ExplorerNode,
  type ExplorerGraph,
} from "@/lib/song-explorer";

interface SongExplorerProps {
  dateStr: string;
  songs: LibrarySong[];
  season: string;
  targetFunction?: string;
  onSelectSong?: (songId: string) => void;
  onClose: () => void;
}

// Layout constants
const SVG_WIDTH = 720;
const SVG_HEIGHT = 480;
const CENTER_X = 100;
const CENTER_Y = SVG_HEIGHT / 2;
const READING_X = 60;
const THEME_X = 260;
const SONG_X = 480;

// Colors
const READING_COLOR = "#92400e"; // amber-800
const THEME_COLOR = "#78716c"; // stone-500
const SONG_COLOR = "#1c1917"; // stone-900
const VINE_COLOR = "#d6d3d1"; // stone-300
const VINE_ACTIVE = "#a16207"; // amber-700
const SCRIPTURE_BADGE = "#fef3c7"; // amber-100

function VinePath({
  x1, y1, x2, y2,
  active = false,
}: {
  x1: number; y1: number; x2: number; y2: number;
  active?: boolean;
}) {
  // Cubic bezier with organic curve
  const midX = (x1 + x2) / 2;
  const cp1x = x1 + (midX - x1) * 0.6;
  const cp2x = x2 - (x2 - midX) * 0.6;
  // Add slight vertical offset for organic feel
  const offsetY = (y2 - y1) * 0.1;

  const d = `M ${x1} ${y1} C ${cp1x} ${y1 + offsetY}, ${cp2x} ${y2 - offsetY}, ${x2} ${y2}`;

  return (
    <path
      d={d}
      fill="none"
      stroke={active ? VINE_ACTIVE : VINE_COLOR}
      strokeWidth={active ? 2 : 1}
      strokeOpacity={active ? 0.9 : 0.35}
      className="transition-all duration-300"
    />
  );
}

function ReadingNode({
  node,
  y,
  isHovered,
  onHover,
}: {
  node: ExplorerNode;
  y: number;
  isHovered: boolean;
  onHover: (id: string | null) => void;
}) {
  return (
    <g
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      className="cursor-pointer"
    >
      {/* Dot */}
      <circle
        cx={READING_X}
        cy={y}
        r={isHovered ? 6 : 4}
        fill={READING_COLOR}
        className="transition-all duration-200"
      />
      {/* Label */}
      <text
        x={READING_X - 12}
        y={y - 10}
        textAnchor="end"
        fontSize="9"
        fontWeight="600"
        fill={isHovered ? READING_COLOR : "#78716c"}
        className="transition-colors duration-200"
      >
        {node.sublabel}
      </text>
      <text
        x={READING_X - 12}
        y={y + 3}
        textAnchor="end"
        fontSize="10"
        fontWeight="700"
        fill={READING_COLOR}
      >
        {node.label}
      </text>
    </g>
  );
}

function ThemeNode({
  node,
  x,
  y,
  isHovered,
  isActive,
  songCount,
  onHover,
  onClick,
}: {
  node: ExplorerNode;
  x: number;
  y: number;
  isHovered: boolean;
  isActive: boolean;
  songCount: number;
  onHover: (id: string | null) => void;
  onClick: (id: string) => void;
}) {
  const radius = isActive ? 22 : isHovered ? 20 : 16;

  return (
    <g
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onClick(node.id)}
      className="cursor-pointer"
    >
      {/* Outer ring */}
      <circle
        cx={x}
        cy={y}
        r={radius + 2}
        fill="none"
        stroke={isActive ? VINE_ACTIVE : isHovered ? THEME_COLOR : "transparent"}
        strokeWidth="1.5"
        strokeOpacity="0.5"
        className="transition-all duration-200"
      />
      {/* Main circle */}
      <circle
        cx={x}
        cy={y}
        r={radius}
        fill={isActive ? "#fef3c7" : isHovered ? "#f5f5f4" : "#fafaf9"}
        stroke={isActive ? VINE_ACTIVE : THEME_COLOR}
        strokeWidth={isActive ? 1.5 : 1}
        className="transition-all duration-200"
      />
      {/* Label */}
      <text
        x={x}
        y={y - 2}
        textAnchor="middle"
        fontSize="9"
        fontWeight={isActive ? "700" : "600"}
        fill={isActive ? VINE_ACTIVE : THEME_COLOR}
      >
        {node.label}
      </text>
      {/* Count */}
      <text
        x={x}
        y={y + 9}
        textAnchor="middle"
        fontSize="8"
        fill={isActive ? "#92400e" : "#a8a29e"}
      >
        {songCount}
      </text>
    </g>
  );
}

function SongNode({
  node,
  x,
  y,
  isHovered,
  isScripture,
  onHover,
  onClick,
}: {
  node: ExplorerNode;
  x: number;
  y: number;
  isHovered: boolean;
  isScripture: boolean;
  onHover: (id: string | null) => void;
  onClick: (songId: string) => void;
}) {
  const maxLabelWidth = 200;

  return (
    <g
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => node.songId && onClick(node.songId)}
      className="cursor-pointer"
    >
      {/* Background pill */}
      <rect
        x={x - 4}
        y={y - 12}
        width={maxLabelWidth + 8}
        height={24}
        rx="4"
        fill={isHovered ? "#f5f5f4" : isScripture ? SCRIPTURE_BADGE : "transparent"}
        stroke={isHovered ? VINE_ACTIVE : "transparent"}
        strokeWidth="1"
        className="transition-all duration-200"
      />
      {/* Dot */}
      <circle
        cx={x}
        cy={y}
        r={isScripture ? 4 : 3}
        fill={isScripture ? VINE_ACTIVE : SONG_COLOR}
        className="transition-all duration-200"
      />
      {/* Title */}
      <text
        x={x + 10}
        y={y - 1}
        fontSize="10"
        fontWeight={isHovered || isScripture ? "600" : "500"}
        fill={SONG_COLOR}
      >
        {node.label.length > 30 ? node.label.slice(0, 28) + "..." : node.label}
      </text>
      {/* Composer + usage */}
      <text
        x={x + 10}
        y={y + 9}
        fontSize="8"
        fill="#a8a29e"
      >
        {node.sublabel ? (node.sublabel.length > 25 ? node.sublabel.slice(0, 23) + "..." : node.sublabel) : ""}
        {node.usageCount ? ` · ${node.usageCount}x` : ""}
      </text>
      {/* Scripture badge */}
      {isScripture && node.reasons && node.reasons.length > 0 && (
        <text
          x={x + 10}
          y={y + 20}
          fontSize="7"
          fontWeight="600"
          fill="#92400e"
        >
          {node.reasons[0]}
        </text>
      )}
    </g>
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

  // Layout positions
  const readingPositions = useMemo(() => {
    const nodes = graph.readingNodes;
    const spacing = Math.min(80, (SVG_HEIGHT - 80) / Math.max(nodes.length, 1));
    const startY = SVG_HEIGHT / 2 - ((nodes.length - 1) * spacing) / 2;
    return nodes.map((n, i) => ({ node: n, y: startY + i * spacing }));
  }, [graph.readingNodes]);

  const themePositions = useMemo(() => {
    const nodes = graph.themeNodes;
    const spacing = Math.min(55, (SVG_HEIGHT - 40) / Math.max(nodes.length, 1));
    const startY = SVG_HEIGHT / 2 - ((nodes.length - 1) * spacing) / 2;
    return nodes.map((n, i) => ({ node: n, x: THEME_X, y: startY + i * spacing }));
  }, [graph.themeNodes]);

  // Filter songs based on active theme
  const visibleSongs = useMemo(() => {
    if (!activeTheme) {
      // Show scripture matches + top scored
      return graph.songNodes.slice(0, 12);
    }
    // Show songs connected to this theme
    const connectedIds = new Set(
      graph.edges
        .filter((e) => e.from === activeTheme)
        .map((e) => e.to)
    );
    const connected = graph.songNodes.filter((n) => connectedIds.has(n.id));
    // Also include direct scripture matches
    const scriptureMatches = graph.songNodes.filter(
      (n) => n.reasons?.some((r) => r.startsWith("Scripture:")) && !connectedIds.has(n.id)
    );
    return [...connected, ...scriptureMatches].slice(0, 12);
  }, [graph, activeTheme]);

  const songPositions = useMemo(() => {
    const spacing = Math.min(36, (SVG_HEIGHT - 40) / Math.max(visibleSongs.length, 1));
    const startY = SVG_HEIGHT / 2 - ((visibleSongs.length - 1) * spacing) / 2;
    return visibleSongs.map((n, i) => ({ node: n, x: SONG_X, y: startY + i * spacing }));
  }, [visibleSongs]);

  // Count songs per theme
  const themeSongCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const edge of graph.edges) {
      if (edge.from.startsWith("t-") && edge.to.startsWith("s-")) {
        counts[edge.from] = (counts[edge.from] || 0) + 1;
      }
    }
    return counts;
  }, [graph.edges]);

  // Active edges based on hover/selection
  const activeEdges = useMemo(() => {
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

  if (graph.readingNodes.length === 0) {
    return (
      <div className="bg-stone-50 rounded-lg p-6 text-center">
        <p className="text-sm text-stone-400">No readings found for this date.</p>
        <button
          onClick={onClose}
          className="mt-2 text-xs text-stone-500 hover:text-stone-700"
        >
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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
        <button
          onClick={onClose}
          className="p-1 hover:bg-stone-200 rounded transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-stone-400">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>

      {/* SVG Vine Visualization */}
      <div className="overflow-x-auto">
        <svg
          width={SVG_WIDTH}
          height={SVG_HEIGHT}
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          className="select-none"
        >
          {/* Column labels */}
          <text x={READING_X} y={20} textAnchor="middle" fontSize="9" fontWeight="700" fill="#a8a29e" className="uppercase">
            Readings
          </text>
          <text x={THEME_X} y={20} textAnchor="middle" fontSize="9" fontWeight="700" fill="#a8a29e" className="uppercase">
            Themes
          </text>
          <text x={SONG_X + 60} y={20} textAnchor="middle" fontSize="9" fontWeight="700" fill="#a8a29e" className="uppercase">
            Songs
          </text>

          {/* Vine paths: Reading → Theme */}
          {graph.edges
            .filter((e) => e.from.startsWith("r-") && e.to.startsWith("t-"))
            .map((edge) => {
              const rPos = readingPositions.find((p) => p.node.id === edge.from);
              const tPos = themePositions.find((p) => p.node.id === edge.to);
              if (!rPos || !tPos) return null;
              const isActive = activeEdges.has(`${edge.from}->${edge.to}`);
              return (
                <VinePath
                  key={`${edge.from}-${edge.to}`}
                  x1={READING_X + 8}
                  y1={rPos.y}
                  x2={tPos.x - 20}
                  y2={tPos.y}
                  active={isActive}
                />
              );
            })}

          {/* Vine paths: Theme → Song */}
          {songPositions.map(({ node: sNode, x: sx, y: sy }) => {
            // Find which theme connects to this song
            const connEdges = graph.edges.filter((e) => e.to === sNode.id);
            return connEdges.map((edge) => {
              const tPos = themePositions.find((p) => p.node.id === edge.from);
              const rPos = readingPositions.find((p) => p.node.id === edge.from);
              const fromPos = tPos || rPos;
              if (!fromPos) return null;
              const fromX = tPos ? tPos.x + 20 : READING_X + 8;
              const fromY = "y" in fromPos ? fromPos.y : 0;
              const isActive = activeEdges.has(`${edge.from}->${edge.to}`);
              return (
                <VinePath
                  key={`${edge.from}-${sNode.id}`}
                  x1={fromX}
                  y1={fromY}
                  x2={sx - 6}
                  y2={sy}
                  active={isActive}
                />
              );
            });
          })}

          {/* Reading nodes */}
          {readingPositions.map(({ node, y }) => (
            <ReadingNode
              key={node.id}
              node={node}
              y={y}
              isHovered={hoveredNode === node.id}
              onHover={setHoveredNode}
            />
          ))}

          {/* Theme nodes */}
          {themePositions.map(({ node, x, y }) => (
            <ThemeNode
              key={node.id}
              node={node}
              x={x}
              y={y}
              isHovered={hoveredNode === node.id}
              isActive={activeTheme === node.id}
              songCount={themeSongCounts[node.id] || 0}
              onHover={setHoveredNode}
              onClick={handleThemeClick}
            />
          ))}

          {/* Song nodes */}
          {songPositions.map(({ node, x, y }) => (
            <SongNode
              key={node.id}
              node={node}
              x={x}
              y={y}
              isHovered={hoveredNode === node.id}
              isScripture={!!node.reasons?.some((r) => r.startsWith("Scripture:"))}
              onHover={setHoveredNode}
              onClick={handleSongClick}
            />
          ))}
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
            className="text-[10px] text-stone-500 hover:text-stone-700 transition-colors"
          >
            Show all
          </button>
        )}
      </div>
    </div>
  );
}
