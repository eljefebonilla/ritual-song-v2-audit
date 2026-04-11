"use client";

/**
 * Edit panel shown below the main preview for the selected page.
 * Handles: crop slider, links, giving block toggle, swap resource.
 */

import { useState, useEffect } from "react";
import type { WorshipAidPage, LinkItem } from "@/lib/worship-aid/types";

// ─── Swap resource modal ──────────────────────────────────────────────────────

interface ResourceOption {
  id: string;
  type: string;
  tags: string[];
  storagePath: string | null;
  previewUrl: string | null;
  label: string;
}

interface SwapModalProps {
  songId: string;
  onClose: () => void;
  onSelect: (previewUrl: string | null, storagePath: string | null) => void;
}

function SwapModal({ songId, onClose, onSelect }: SwapModalProps) {
  const [options, setOptions] = useState<ResourceOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOptions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/worship-aids/swap-resource", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load resources");
      setOptions(data.options);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  if (options === null && !loading && !error) {
    loadOptions();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-[520px] max-h-[80vh] flex flex-col">
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
          <h3 className="font-semibold text-stone-800 text-sm">Swap Reprint Resource</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-lg leading-none">
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && <p className="text-sm text-stone-500">Loading resources...</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {options && options.length === 0 && (
            <p className="text-sm text-stone-500 italic">No resources found in database.</p>
          )}
          {options && options.map((opt) => (
            <div
              key={opt.id}
              className="flex items-center gap-3 py-2 border-b border-stone-100 last:border-0 cursor-pointer hover:bg-stone-50 rounded px-2"
              onClick={() => { onSelect(opt.previewUrl, opt.storagePath); onClose(); }}
            >
              {opt.previewUrl && (
                <img
                  src={opt.previewUrl}
                  alt={opt.label}
                  className="w-12 h-12 object-contain border border-stone-200 rounded flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-stone-700 truncate">{opt.label}</p>
                <p className="text-[10px] text-stone-400 truncate">{opt.tags.join(", ")}</p>
              </div>
              <span className="text-xs text-blue-600 font-medium flex-shrink-0">Select</span>
            </div>
          ))}
          <div className="mt-4 pt-3 border-t border-stone-100">
            <button
              disabled
              className="text-xs text-stone-400 italic"
            >
              Upload new (coming soon)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Add link form ────────────────────────────────────────────────────────────

interface AddLinkFormProps {
  onAdd: (link: LinkItem) => void;
}

function AddLinkForm({ onAdd }: AddLinkFormProps) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");

  const handleAdd = () => {
    if (!label.trim() || !url.trim()) return;
    onAdd({ label: label.trim(), url: url.trim(), icon: "✚" });
    setLabel("");
    setUrl("");
  };

  return (
    <div className="flex items-center gap-2 mt-1">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Label"
        className="text-xs border border-stone-200 rounded px-2 py-1 w-32 focus:outline-none focus:ring-1 focus:ring-stone-400"
      />
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="URL"
        className="text-xs border border-stone-200 rounded px-2 py-1 flex-1 focus:outline-none focus:ring-1 focus:ring-stone-400"
      />
      <button
        onClick={handleAdd}
        disabled={!label.trim() || !url.trim()}
        className="text-xs px-2 py-1 bg-stone-800 text-white rounded disabled:opacity-40 hover:bg-stone-700"
      >
        Add
      </button>
    </div>
  );
}

// ─── Logo picker for cover page ──────────────────────────────────────────────

interface LogoOption {
  folder: string;
  folderLabel: string;
  file: string;
  variant: string;
  variantLabel: string;
  url: string;
}

function CoverEditPanel({ page, onUpdate }: PageEditPanelProps) {
  const [logos, setLogos] = useState<LogoOption[] | null>(null);

  useEffect(() => {
    fetch("/api/worship-aids/logos")
      .then((res) => res.json())
      .then((data) => setLogos(data.logos))
      .catch(() => setLogos([]));
  }, []);

  const currentLogo = page.coverData?.logoUrl ?? null;
  const logoScale = page.coverData?.logoScale ?? 1;
  const logoOffsetY = page.coverData?.logoOffsetY ?? 0;

  const updateCover = (patch: Record<string, unknown>) => {
    if (!page.coverData) return;
    onUpdate({ coverData: { ...page.coverData, ...patch } });
  };

  // Group logos by folder
  const folders = logos
    ? [...new Set(logos.map((l) => l.folder))].map((f) => ({
        key: f,
        label: logos.find((l) => l.folder === f)?.folderLabel ?? f,
        items: logos.filter((l) => l.folder === f),
      }))
    : [];

  const [openFolder, setOpenFolder] = useState<string | null>(null);

  const checkerBg = {
    backgroundImage: "linear-gradient(45deg, #e5e5e5 25%, transparent 25%), linear-gradient(-45deg, #e5e5e5 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e5e5 75%), linear-gradient(-45deg, transparent 75%, #e5e5e5 75%)",
    backgroundSize: "10px 10px",
    backgroundPosition: "0 0, 0 5px, 5px -5px, -5px 0px",
  };

  return (
    <div className="w-full space-y-3">
      {/* Logo picker with folders */}
      <div className="bg-white border border-stone-200 rounded-lg px-3 py-3">
        <p className="text-xs font-medium text-stone-600 mb-2">Parish Logo</p>
        {!logos ? (
          <p className="text-xs text-stone-400">Loading...</p>
        ) : (
          <div className="space-y-1.5">
            {folders.map((folder) => {
              const isOpen = openFolder === folder.key;
              const hasActive = folder.items.some((l) => l.url === currentLogo);
              return (
                <div key={folder.key}>
                  <button
                    onClick={() => setOpenFolder(isOpen ? null : folder.key)}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-colors ${
                      hasActive ? "bg-stone-100 font-semibold text-stone-800" : "hover:bg-stone-50 text-stone-600"
                    }`}
                  >
                    <span>{folder.label}</span>
                    <span className="text-[10px] text-stone-400">{isOpen ? "▾" : "▸"} {folder.items.length}</span>
                  </button>
                  {isOpen && (
                    <div className="grid grid-cols-3 gap-1 mt-1 mb-1">
                      {folder.items.map((logo) => {
                        const isActive = currentLogo === logo.url;
                        return (
                          <button
                            key={logo.url}
                            onClick={() => updateCover({ logoUrl: logo.url })}
                            className={`relative flex flex-col items-center gap-0.5 p-1 rounded border transition-all ${
                              isActive
                                ? "border-stone-800 ring-1 ring-stone-800"
                                : "border-stone-200 hover:border-stone-400"
                            }`}
                          >
                            <div className="w-full aspect-square flex items-center justify-center rounded overflow-hidden" style={checkerBg}>
                              <img
                                src={logo.url}
                                alt={logo.variantLabel}
                                className="max-w-full max-h-full object-contain"
                              />
                            </div>
                            <span className="text-[7px] text-stone-500 leading-tight text-center truncate w-full">
                              {logo.variantLabel}
                            </span>
                            {isActive && (
                              <div className="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-stone-800 rounded-full flex items-center justify-center">
                                <span className="text-white text-[6px] leading-none">&#10003;</span>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Logo size */}
      <div className="bg-white border border-stone-200 rounded-lg px-3 py-3">
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-stone-600">Logo size</label>
          <span className="text-xs text-stone-400">{Math.round(logoScale * 100)}%</span>
        </div>
        <input
          type="range"
          min={30}
          max={200}
          value={Math.round(logoScale * 100)}
          onChange={(e) => updateCover({ logoScale: Number(e.target.value) / 100 })}
          className="w-full accent-stone-700"
        />
      </div>

      {/* Logo vertical position */}
      <div className="bg-white border border-stone-200 rounded-lg px-3 py-3">
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-stone-600">Logo position</label>
          <span className="text-xs text-stone-400">{logoOffsetY > 0 ? "+" : ""}{logoOffsetY}%</span>
        </div>
        <input
          type="range"
          min={-50}
          max={50}
          value={logoOffsetY}
          onChange={(e) => updateCover({ logoOffsetY: Number(e.target.value) })}
          className="w-full accent-stone-700"
        />
      </div>
    </div>
  );
}

// ─── Main edit panel ─────────────────────────────────────────────────────────

export interface PageEditPanelProps {
  page: WorshipAidPage;
  onUpdate: (updates: Partial<WorshipAidPage>) => void;
}

export function PageEditPanel({ page, onUpdate }: PageEditPanelProps) {
  const [showSwap, setShowSwap] = useState(false);

  if (page.type === "cover") {
    return <CoverEditPanel page={page} onUpdate={onUpdate} />;
  }

  if (page.type === "reading") {
    return null;
  }

  if (page.type !== "song") return null;

  const links = page.customLinks ?? [];

  const handleCropChange = (val: number) => {
    onUpdate({ cropTop: val });
  };

  const handleAddLink = (link: LinkItem) => {
    onUpdate({ customLinks: [...links, link] });
  };

  const handleRemoveLink = (idx: number) => {
    onUpdate({ customLinks: links.filter((_, i) => i !== idx) });
  };

  const handleGivingToggle = () => {
    onUpdate({ givingBlock: !page.givingBlock });
  };

  const handleSwapSelect = (previewUrl: string | null, storagePath: string | null) => {
    if (!page.songData) return;
    const newSongData = {
      ...page.songData,
      reprintUrl: previewUrl,
      reprint:
        storagePath
          ? { kind: "gif" as const, storagePath }
          : { kind: "title_only" as const },
    };
    onUpdate({ songData: newSongData });
  };

  return (
    <div className="w-full space-y-3">
      {/* Crop slider */}
      <div className="bg-white border border-stone-200 rounded-lg px-4 py-3">
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-stone-600">Crop top header</label>
          <span className="text-xs text-stone-400">{page.cropTop}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={30}
          value={page.cropTop}
          onChange={(e) => handleCropChange(Number(e.target.value))}
          className="w-full accent-stone-700"
        />
      </div>

      {/* Swap resource */}
      {page.songData?.songId && (
        <div className="bg-white border border-stone-200 rounded-lg px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-600">Sheet music resource</span>
            <button
              onClick={() => setShowSwap(true)}
              className="text-xs px-2 py-1 border border-stone-300 rounded text-stone-600 hover:bg-stone-50"
            >
              Swap
            </button>
          </div>
          <p className="text-[10px] text-stone-400 mt-1">
            {page.songData.reprint.kind === "title_only"
              ? "No reprint — title only"
              : page.songData.reprint.kind === "lyrics"
              ? "Lyrics text"
              : `${page.songData.reprint.kind.toUpperCase()} resource`}
          </p>
        </div>
      )}

      {/* Custom links */}
      <div className="bg-white border border-stone-200 rounded-lg px-4 py-3">
        <p className="text-xs font-medium text-stone-600 mb-2">Hyperlinks on this page</p>
        {links.length > 0 && (
          <ul className="space-y-1 mb-2">
            {links.map((l, i) => (
              <li key={i} className="flex items-center gap-2 text-xs">
                <span className="text-stone-400">✚</span>
                <span className="flex-1 truncate text-stone-700">{l.label}</span>
                <span className="text-stone-400 truncate flex-1">{l.url}</span>
                <button
                  onClick={() => handleRemoveLink(i)}
                  className="text-stone-300 hover:text-red-500 font-bold leading-none"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <AddLinkForm onAdd={handleAddLink} />
      </div>

      {/* Giving block */}
      <div className="bg-white border border-stone-200 rounded-lg px-4 py-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!page.givingBlock}
            onChange={handleGivingToggle}
            className="rounded border-stone-300"
          />
          <span className="text-xs font-medium text-stone-600">Add giving block (QR code)</span>
        </label>
        {page.givingBlock && (
          <p className="text-[10px] text-stone-400 mt-1 ml-5">
            QR + stmonica.net/give text will appear below sheet music.
          </p>
        )}
      </div>

      {showSwap && page.songData?.songId && (
        <SwapModal
          songId={page.songData.songId}
          onClose={() => setShowSwap(false)}
          onSelect={handleSwapSelect}
        />
      )}
    </div>
  );
}
