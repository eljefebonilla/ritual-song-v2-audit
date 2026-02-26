"use client";

import type { GridCellData } from "@/lib/grid-types";
import { useUser } from "@/lib/user-context";

interface GridCellProps {
  data: GridCellData;
  isEven: boolean;
}

export default function GridCell({ data, isEven }: GridCellProps) {
  const { role } = useUser();

  if (data.isEmpty) {
    return (
      <div
        className={`px-2 py-1.5 h-full flex items-center border-b border-r border-stone-100 ${
          isEven ? "bg-stone-50/50" : "bg-white"
        }`}
      >
        <span className="text-stone-200 text-xs">—</span>
      </div>
    );
  }

  return (
    <div
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
