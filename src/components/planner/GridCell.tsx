"use client";

import type { GridCellData } from "@/lib/grid-types";
import { useUser } from "@/lib/user-context";

interface GridCellProps {
  data: GridCellData;
  isEven: boolean;
  onEdit?: (rect: DOMRect) => void;
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
    return (
      <div
        className="px-2 py-1.5 h-full border-b border-r border-stone-100 bg-stone-50/80"
        title={data.description ? `${data.title} — ${data.description}` : data.title}
      >
        {data.title && (
          <p className="text-[10px] font-semibold text-stone-600 leading-tight">
            {data.title}
          </p>
        )}
        {data.description && (
          <p className="text-[10px] italic text-stone-400 leading-tight">
            {data.description}
          </p>
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
      {data.composer && (
        <p className="text-[10px] text-stone-400 leading-tight truncate">
          {data.composer}
        </p>
      )}
      {hasAudio && onPlay && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlay();
          }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center justify-center w-6 h-6 rounded-full bg-stone-800/80 text-white hover:bg-stone-800 transition-colors"
          title="Play"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5,3 19,12 5,21" />
          </svg>
        </button>
      )}
      {role === "admin" && !onDetail && (
        <span className="hidden group-hover:inline-block text-[9px] text-amber-500 mt-0.5">
          edit
        </span>
      )}
      {role === "member" && !data.isEmpty && (
        <span className="hidden group-hover:inline-block text-[9px] text-blue-400 mt-0.5">
          suggest
        </span>
      )}
    </div>
  );
}
