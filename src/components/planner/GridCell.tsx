"use client";

import type { GridCellData } from "@/lib/grid-types";
import { useUser } from "@/lib/user-context";

interface GridCellProps {
  data: GridCellData;
  isEven: boolean;
  onEdit?: (rect: DOMRect) => void;
}

export default function GridCell({ data, isEven, onEdit }: GridCellProps) {
  const { role } = useUser();

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (role === "admin" && onEdit && !data.isReading) {
      onEdit(e.currentTarget.getBoundingClientRect());
    }
  };

  if (data.isEmpty) {
    return (
      <div
        className={`px-2 py-1.5 h-full flex items-center border-b border-r border-stone-100 ${
          data.isReading
            ? "bg-stone-50/80"
            : isEven ? "bg-stone-50/50" : "bg-white"
        }`}
      >
        <span className="text-stone-200 text-xs">&mdash;</span>
      </div>
    );
  }

  // Reading rows: non-editable, lighter background, italic
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

  // Music rows: editable
  return (
    <div
      onClick={handleClick}
      className={`px-2 py-1.5 h-full border-b border-r border-stone-100 group ${
        isEven ? "bg-stone-50/50" : "bg-white"
      } ${role === "admin" ? "hover:bg-amber-50/60 cursor-pointer" : ""}`}
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
