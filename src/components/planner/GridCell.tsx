"use client";

import type { GridCellData } from "@/lib/grid-types";
import { useUser } from "@/lib/user-context";
import InlinePlayButton from "@/components/ui/InlinePlayButton";

interface GridCellProps {
  data: GridCellData;
  isEven: boolean;
  onEdit?: (rect: DOMRect) => void;
  onClear?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  isDragOver?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDetail?: () => void;
  onPlay?: () => void;
  hasAudio?: boolean;
}

export default function GridCell({
  data,
  isEven,
  onEdit,
  onClear,
  draggable,
  onDragStart,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onDetail,
  onPlay,
  hasAudio,
}: GridCellProps) {
  const { role } = useUser();

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (role === "admin" && onEdit && !data.isReading) {
      onEdit(e.currentTarget.getBoundingClientRect());
    }
  };

  // Empty cells — can be drop targets for song copy
  if (data.isEmpty) {
    return (
      <div
        className={`px-2 py-1.5 h-full flex items-center border-b border-r border-stone-100 ${
          data.isReading
            ? "bg-stone-50/80"
            : isEven ? "bg-stone-50/50" : "bg-white"
        } ${isDragOver ? "ring-2 ring-inset ring-amber-400" : ""}`}
        onClick={handleClick}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <span className="text-stone-200 text-xs">&mdash;</span>
      </div>
    );
  }

  // Reading rows: non-editable, no drag
  if (data.isReading) {
    const descColor = data.isVerbatim ? "text-parish-burgundy" : "text-[#374151]";
    return (
      <div
        className="px-2 py-1.5 border-b border-r border-stone-100 bg-stone-50/80"
        title={data.description ? `${data.title} — ${data.description}` : data.title}
      >
        {data.title && (
          <p className="text-[10px] leading-tight text-stone-400">{data.title}</p>
        )}
        {data.description && (
          <p className={`text-[10px] leading-tight font-medium ${descColor}`}>{data.description}</p>
        )}
      </div>
    );
  }

  // Music rows: editable + draggable + drop target + detail/play
  return (
    <div
      onClick={handleClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`px-2 py-1.5 h-full border-b border-r border-stone-100 group relative ${
        isEven ? "bg-stone-50/50" : "bg-white"
      } ${role === "admin" ? "hover:bg-amber-50/60" : ""} ${
        draggable ? "cursor-grab active:cursor-grabbing" : role === "admin" ? "cursor-pointer" : ""
      } ${isDragOver ? "ring-2 ring-inset ring-amber-400" : ""}`}
      title={data.composer ? `${data.title} — ${data.composer}` : data.title}
    >
      <div className="flex items-center gap-1">
        {/* Play button — always visible */}
        {hasAudio && onPlay ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlay();
            }}
            className="shrink-0 flex items-center justify-center w-4 h-4 rounded-full bg-stone-800 transition-colors active:scale-95"
            title="Play"
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}
          >
            <svg width="7" height="7" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2.5" strokeLinejoin="round">
              <polygon points="6,3 20,12 6,21" />
            </svg>
          </button>
        ) : (
          <span
            className="shrink-0 flex items-center justify-center w-4 h-4 rounded-full bg-stone-200 relative"
            title="No audio"
          >
            <svg width="7" height="7" viewBox="0 0 24 24" fill="#a8a29e" stroke="#a8a29e" strokeWidth="2.5" strokeLinejoin="round">
              <polygon points="6,3 20,12 6,21" />
            </svg>
            <svg className="absolute inset-0" width="16" height="16" viewBox="0 0 16 16">
              <line x1="3" y1="13" x2="13" y2="3" stroke="#78716c" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </span>
        )}
        <p
          className={`text-[11px] font-medium text-stone-800 leading-tight truncate ${
            onDetail ? "hover:text-amber-700 hover:underline cursor-pointer" : ""
          }`}
          onClick={(e) => {
            if (onDetail) {
              e.stopPropagation();
              onDetail();
            }
          }}
        >
          {data.title}
        </p>
      </div>
      {data.composer && (
        <p className="text-[10px] text-stone-400 leading-tight truncate pl-5">
          {data.composer}
        </p>
      )}
      {/* Hover actions — z-10 ensures buttons layer above the cell below */}
      <div className="absolute right-1 top-1/2 -translate-y-1/2 z-10 hidden group-hover:flex items-center gap-0.5">
        {role === "admin" && onClear && !data.isEmpty && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-500 hover:bg-red-200 hover:text-red-700 transition-colors"
            title="Clear"
          >
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
