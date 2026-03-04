"use client";

import { useState, useRef } from "react";
import type { SongResource, SongResourceType } from "@/lib/types";
import {
  FILE_TYPE_GROUPS,
  MODIFIER_TAGS,
  FILE_TYPE_TAG_IDS,
  buildLabelFromTags,
  buildStorageName,
} from "@/lib/resource-tags";

const UPLOAD_ACCEPT = ".pdf,.mp3,.wav,.m4a,.aif,.aiff,.png,.jpg,.jpeg,.musx,.mxl,.txt";

const RESOURCE_TYPE_LABELS: Record<SongResourceType, string> = {
  audio: "Audio",
  sheet_music: "Sheet Music",
  practice_track: "Practice Track",
  hymnal_ref: "Hymnal Reference",
  notation: "Notation",
  lyrics: "Lyrics",
  ocp_link: "OCP",
  youtube: "YouTube",
  other: "Other",
};

interface ResourceUploadFormProps {
  songId: string;
  songTitle: string;
  songComposer?: string;
  onResourceAdded: (resource: SongResource) => void;
  onAudioUploaded?: (songId: string, url: string) => void;
  onCancel: () => void;
}

export default function ResourceUploadForm({
  songId,
  songTitle,
  songComposer,
  onResourceAdded,
  onAudioUploaded,
  onCancel,
}: ResourceUploadFormProps) {
  // Mode
  const [addMode, setAddMode] = useState<"link" | "upload">("upload");

  // Shared state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const uploadingRef = useRef(false);

  // Link mode state
  const [newType, setNewType] = useState<SongResourceType>("youtube");
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");

  // Upload mode state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Tag selection state
  const [selectedTypeTag, setSelectedTypeTag] = useState<string>("");
  const [selectedModifiers, setSelectedModifiers] = useState<Set<string>>(new Set());
  const [customTags, setCustomTags] = useState("");
  const [visibility, setVisibility] = useState<"all" | "admin">("all");

  // Computed tags array
  const allTags = (() => {
    const tags: string[] = [];
    if (selectedTypeTag) tags.push(selectedTypeTag);
    for (const m of selectedModifiers) tags.push(m);
    // Parse custom tags (comma or space separated)
    if (customTags.trim()) {
      const custom = customTags.split(/[,\s]+/).map((t) => t.trim().toUpperCase()).filter(Boolean);
      for (const t of custom) {
        if (!tags.includes(t)) tags.push(t);
      }
    }
    return tags;
  })();

  // Auto-generated label and filename
  const autoLabel = allTags.length > 0 ? buildLabelFromTags(allTags) : "";
  const autoFilename = (() => {
    if (!uploadFile || !selectedTypeTag) return "";
    const ext = uploadFile.name.includes(".")
      ? uploadFile.name.slice(uploadFile.name.lastIndexOf("."))
      : "";
    const modifiers = allTags.filter((t) => !FILE_TYPE_TAG_IDS.includes(t));
    return buildStorageName(songTitle, songComposer, selectedTypeTag, modifiers, ext);
  })();

  const handleFileSelected = (file: File) => {
    setUploadFile(file);
    // Auto-detect resource type from extension
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "pdf" || ext === "png" || ext === "jpg" || ext === "jpeg") {
      setNewType("sheet_music");
    } else if (["mp3", "wav", "m4a", "aif", "aiff"].includes(ext || "")) {
      setNewType("audio");
    } else if (["musx", "mxl", "musicxml"].includes(ext || "")) {
      setNewType("notation");
    } else if (ext === "txt") {
      setNewType("lyrics");
    } else {
      setNewType("other");
    }
  };

  const toggleModifier = (id: string) => {
    setSelectedModifiers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleUploadFile = async () => {
    if (!uploadFile || !selectedTypeTag || uploadingRef.current) return;
    uploadingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const label = autoLabel;
      const type: SongResourceType =
        newType !== "youtube" && newType !== "ocp_link" ? newType : "other";

      // Step 1: Get signed upload URL
      const urlRes = await fetch(`/api/songs/${songId}/resources/signed-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: allTags, fileName: uploadFile.name }),
      });
      if (!urlRes.ok) {
        const d = await urlRes.json().catch(() => ({}));
        setSaveError(d.error || `Prepare failed (${urlRes.status})`);
        return;
      }
      const { signedUrl, storagePath } = await urlRes.json();

      // Step 2: Upload file directly to Supabase Storage
      const storageRes = await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": uploadFile.type || "application/octet-stream" },
        body: uploadFile,
      });
      if (!storageRes.ok) {
        const text = await storageRes.text().catch(() => "");
        setSaveError(`Storage upload failed (${storageRes.status}): ${text}`);
        return;
      }

      // Step 3: Register resource metadata
      const regRes = await fetch(`/api/songs/${songId}/resources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          label,
          storagePath,
          tags: allTags,
          visibility,
        }),
      });
      if (!regRes.ok) {
        const d = await regRes.json().catch(() => ({}));
        setSaveError(d.error || `Register failed (${regRes.status})`);
        return;
      }

      const data = await regRes.json();
      onResourceAdded(data.resource);

      if (
        (type === "audio" || type === "practice_track") &&
        data.resource.url &&
        onAudioUploaded
      ) {
        onAudioUploaded(songId, data.resource.url);
      }

      // Reset
      resetForm();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
      uploadingRef.current = false;
    }
  };

  const handleAddLink = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/songs/${songId}/resources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: newType,
          label: newLabel.trim(),
          url: newUrl.trim() || undefined,
          tags: allTags,
          visibility,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onResourceAdded(data.resource);
        resetForm();
      } else {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.error || `Failed (${res.status})`);
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setNewLabel("");
    setNewUrl("");
    setUploadFile(null);
    setSelectedTypeTag("");
    setSelectedModifiers(new Set());
    setCustomTags("");
    setVisibility("all");
    setSaveError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onCancel();
  };

  return (
    <div className="space-y-2">
      {/* Mode toggle */}
      <div className="flex rounded-md border border-stone-200 overflow-hidden">
        <button
          onClick={() => setAddMode("link")}
          className={`flex-1 px-2 py-1 text-[10px] font-medium transition-colors ${
            addMode === "link"
              ? "bg-stone-900 text-white"
              : "bg-white text-stone-500 hover:bg-stone-50"
          }`}
        >
          Add Link
        </button>
        <button
          onClick={() => setAddMode("upload")}
          className={`flex-1 px-2 py-1 text-[10px] font-medium transition-colors ${
            addMode === "upload"
              ? "bg-stone-900 text-white"
              : "bg-white text-stone-500 hover:bg-stone-50"
          }`}
        >
          Upload File
        </button>
      </div>

      {addMode === "link" ? (
        <>
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as SongResourceType)}
            className="w-full text-xs border border-stone-200 rounded-md px-2 py-1.5"
          >
            {Object.entries(RESOURCE_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Label (e.g., YouTube Recording)"
            className="w-full text-xs border border-stone-200 rounded-md px-2 py-1.5"
          />
          <input
            type="text"
            value={newUrl}
            onChange={(e) => {
              const url = e.target.value;
              setNewUrl(url);
              if (
                (url.includes("youtube.com") || url.includes("youtu.be")) &&
                newType !== "youtube"
              ) {
                setNewType("youtube");
                if (!newLabel) setNewLabel("YouTube");
              }
            }}
            placeholder="URL (YouTube, Dropbox, etc.)"
            className="w-full text-xs border border-stone-200 rounded-md px-2 py-1.5"
          />

          {/* Tag section for links */}
          <TagSelector
            selectedTypeTag={selectedTypeTag}
            selectedModifiers={selectedModifiers}
            customTags={customTags}
            visibility={visibility}
            onTypeTagChange={setSelectedTypeTag}
            onToggleModifier={toggleModifier}
            onCustomTagsChange={setCustomTags}
            onVisibilityChange={setVisibility}
          />

          {saveError && (
            <p className="text-[10px] text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
              {saveError}
            </p>
          )}
          <div className="flex gap-2">
            <button
              disabled={saving || !newLabel.trim()}
              onClick={handleAddLink}
              className="flex-1 px-3 py-1.5 text-xs font-medium bg-stone-900 text-white rounded-md hover:bg-stone-800 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Add Link"}
            </button>
            <button
              onClick={resetForm}
              className="px-3 py-1.5 text-xs font-medium text-stone-500 rounded-md hover:bg-stone-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          {/* File picker / drop zone */}
          <input
            ref={fileInputRef}
            type="file"
            accept={UPLOAD_ACCEPT}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelected(file);
            }}
            className="hidden"
          />
          {uploadFile ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-stone-50 border border-stone-200 rounded-md">
              <svg className="w-4 h-4 text-stone-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span className="text-xs text-stone-700 truncate flex-1">{uploadFile.name}</span>
              <button
                onClick={() => {
                  setUploadFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="text-stone-400 hover:text-stone-600"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ) : (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleFileSelected(file);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-1 px-3 py-4 border-2 border-dashed rounded-md cursor-pointer transition-colors ${
                dragOver
                  ? "border-stone-900 bg-stone-50"
                  : "border-stone-300 hover:border-stone-400"
              }`}
            >
              <svg className="w-5 h-5 text-stone-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <p className="text-xs text-stone-500">Drop file here or click to browse</p>
              <p className="text-[10px] text-stone-400">PDF, audio, images, notation</p>
            </div>
          )}

          {/* Tag selector */}
          <TagSelector
            selectedTypeTag={selectedTypeTag}
            selectedModifiers={selectedModifiers}
            customTags={customTags}
            visibility={visibility}
            onTypeTagChange={setSelectedTypeTag}
            onToggleModifier={toggleModifier}
            onCustomTagsChange={setCustomTags}
            onVisibilityChange={setVisibility}
          />

          {/* Auto-generated filename preview */}
          {autoFilename && (
            <div className="px-2 py-1.5 bg-stone-50 border border-stone-200 rounded-md">
              <p className="text-[10px] text-stone-400 mb-0.5">Storage filename:</p>
              <p className="text-[11px] text-stone-600 font-mono truncate">{autoFilename}</p>
            </div>
          )}

          {saveError && (
            <p className="text-[10px] text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
              {saveError}
            </p>
          )}
          <div className="flex gap-2">
            <button
              disabled={saving || !uploadFile || !selectedTypeTag}
              onClick={handleUploadFile}
              className="flex-1 px-3 py-1.5 text-xs font-medium bg-stone-900 text-white rounded-md hover:bg-stone-800 transition-colors disabled:opacity-50"
            >
              {saving ? "Uploading..." : "Upload"}
            </button>
            <button
              onClick={resetForm}
              className="px-3 py-1.5 text-xs font-medium text-stone-500 rounded-md hover:bg-stone-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// --- Tag Selector Sub-component ---

function TagSelector({
  selectedTypeTag,
  selectedModifiers,
  customTags,
  visibility,
  onTypeTagChange,
  onToggleModifier,
  onCustomTagsChange,
  onVisibilityChange,
}: {
  selectedTypeTag: string;
  selectedModifiers: Set<string>;
  customTags: string;
  visibility: "all" | "admin";
  onTypeTagChange: (tag: string) => void;
  onToggleModifier: (id: string) => void;
  onCustomTagsChange: (tags: string) => void;
  onVisibilityChange: (v: "all" | "admin") => void;
}) {
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
