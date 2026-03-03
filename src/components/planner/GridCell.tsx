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
}

export default function GridCell({ data, isEven, onEdit, draggable, onDragStart, isDragOver, onDragOver, onDragLeave, onDrop }: GridCellProps) {
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
        <p className="text-[10px] italic text-stone-500 leading-tight truncate">
          {data.title}
        </p>
        {data.description && (
          <p className="text-[9px] italic text-stone-400 leading-tight truncate">
            {data.description}
          </p>
        )}
      </div>
    );
  }

  // Music rows: editable + draggable + drop target
  return (
    <div
      onClick={handleClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`px-2 py-1.5 h-full border-b border-r border-stone-100 group ${
        isEven ? "bg-stone-50/50" : "bg-white"
      } ${role === "admin" ? "hover:bg-amber-50/60" : ""} ${
        draggable ? "cursor-grab active:cursor-grabbing" : role === "admin" ? "cursor-pointer" : ""
      } ${isDragOver ? "ring-2 ring-inset ring-amber-400" : ""}`}
      title={data.composer ? `${data.title} — ${data.composer}` : data.title}
    >
      <p className="text-[11px] font-medium text-stone-800 leading-tight truncate">
        {data.title}
      </p>
      {data.composer && (
        <p className="text-[10px] text-stone-400 leading-tight truncate">
          {data.composer}
        </p>
      )}
      {role === "admin" && (
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
