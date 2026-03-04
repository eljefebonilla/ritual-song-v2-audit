"use client";

import {
  FILE_TYPE_GROUPS,
  MODIFIER_TAGS,
  SEASON_TAGS,
  FUNCTION_TAGS,
} from "@/lib/resource-tags";

interface TagSelectorProps {
  selectedTypeTag: string;
  selectedModifiers: Set<string>;
  customTags: string;
  visibility: "all" | "admin";
  onTypeTagChange: (tag: string) => void;
  onToggleModifier: (id: string) => void;
  onCustomTagsChange: (tags: string) => void;
  onVisibilityChange: (v: "all" | "admin") => void;
}

export default function TagSelector({
  selectedTypeTag,
  selectedModifiers,
  customTags,
  visibility,
  onTypeTagChange,
  onToggleModifier,
  onCustomTagsChange,
  onVisibilityChange,
}: TagSelectorProps) {
  return (
    <div className="space-y-2 border border-stone-200 rounded-md p-2">
      <p className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Tags</p>

      {/* File Type Tag (grouped dropdown) */}
      <select
        value={selectedTypeTag}
        onChange={(e) => onTypeTagChange(e.target.value)}
        className="w-full text-xs border border-stone-200 rounded-md px-2 py-1.5"
      >
        <option value="">Select file type...</option>
        {FILE_TYPE_GROUPS.map((group) => (
          <optgroup key={group.group} label={group.label}>
            {group.tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.label} ({tag.id})
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {/* Modifier checkboxes */}
      <div className="flex gap-3">
        {MODIFIER_TAGS.map((mod) => (
          <label key={mod.id} className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedModifiers.has(mod.id)}
              onChange={() => onToggleModifier(mod.id)}
              className="w-3 h-3 rounded border-stone-300"
            />
            <span className="text-xs text-stone-600">{mod.label}</span>
            <span className="text-[10px] text-stone-400">({mod.id})</span>
          </label>
        ))}
      </div>

      {/* Season tags */}
      <div>
        <p className="text-[9px] uppercase tracking-wider font-bold text-stone-300 mb-1">Season</p>
        <div className="flex flex-wrap gap-1.5">
          {SEASON_TAGS.map((tag) => (
            <label key={tag.id} className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedModifiers.has(tag.id)}
                onChange={() => onToggleModifier(tag.id)}
                className="w-3 h-3 rounded border-stone-300"
              />
              <span className="text-[11px] text-stone-600">{tag.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Function / Mass part tags */}
      <div>
        <p className="text-[9px] uppercase tracking-wider font-bold text-stone-300 mb-1">Mass Part</p>
        <div className="flex flex-wrap gap-1.5">
          {FUNCTION_TAGS.map((tag) => (
            <label key={tag.id} className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedModifiers.has(tag.id)}
                onChange={() => onToggleModifier(tag.id)}
                className="w-3 h-3 rounded border-stone-300"
              />
              <span className="text-[11px] text-stone-600">{tag.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Additional custom tags */}
      <input
        type="text"
        value={customTags}
        onChange={(e) => onCustomTagsChange(e.target.value)}
        placeholder="Additional tags (comma-separated, e.g. VLN, DESCANT)"
        className="w-full text-[11px] border border-stone-200 rounded-md px-2 py-1.5 text-stone-500"
      />

      {/* Visibility toggle */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-stone-400">Visibility:</span>
        <button
          onClick={() => onVisibilityChange(visibility === "all" ? "admin" : "all")}
          className={`px-2 py-0.5 text-[10px] font-medium rounded-full transition-colors ${
            visibility === "all"
              ? "bg-emerald-100 text-emerald-700"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {visibility === "all" ? "Everyone" : "Admin Only"}
        </button>
      </div>
    </div>
  );
}
