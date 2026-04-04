"use client";

import { useState, useEffect, useCallback } from "react";

interface BrandConfigState {
  parish_display_name: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  heading_font: string;
  body_font: string;
  layout_preset: "classic" | "modern" | "warm";
  cover_style: "photo" | "gradient" | "ai";
  header_overlay_mode: "banner" | "replace";
  logo_url: string | null;
  logo_storage_path: string | null;
}

const DEFAULTS: BrandConfigState = {
  parish_display_name: "",
  primary_color: "#333333",
  secondary_color: "#666666",
  accent_color: "#4A90D9",
  heading_font: "Playfair Display",
  body_font: "Inter",
  layout_preset: "modern",
  cover_style: "gradient",
  header_overlay_mode: "banner",
  logo_url: null,
  logo_storage_path: null,
};

const FONT_PRESETS = {
  heading: [
    "Playfair Display",
    "Eidetic Neo",
    "Georgia",
    "Garamond",
    "Crimson Text",
    "Libre Baskerville",
  ],
  body: [
    "Inter",
    "Minion Pro",
    "Source Sans 3",
    "Lato",
    "Open Sans",
    "Roboto",
  ],
};

const LAYOUT_PRESETS: { id: BrandConfigState["layout_preset"]; name: string; desc: string }[] = [
  { id: "classic", name: "Classic", desc: "Cathedral/traditional. Larger headings, wider spacing, elegant borders." },
  { id: "modern", name: "Modern", desc: "Clean and minimal. Thin borders, compact layout, sans-serif leaning." },
  { id: "warm", name: "Warm", desc: "Earthy and friendly. Dotted accents, softer colors, welcoming feel." },
];

export default function BrandConfigPage() {
  const [config, setConfig] = useState<BrandConfigState>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    fetch("/api/brand-config")
      .then((r) => r.json())
      .then((data) => {
        if (data.config) {
          setConfig({ ...DEFAULTS, ...data.config });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/brand-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Brand settings saved." });
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: err.error || "Save failed" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setSaving(false);
    }
  }, [config]);

  const update = <K extends keyof BrandConfigState>(key: K, value: BrandConfigState[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return <div className="p-8 text-stone-500">Loading brand settings...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-6 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Brand Settings</h1>
          <p className="text-sm text-stone-500 mt-1">
            Configure how your setlists and worship aids look.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-stone-900 text-white text-sm rounded-lg hover:bg-stone-800 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      {message && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            message.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-8">
        {/* Parish Name */}
        <section>
          <h2 className="text-sm font-semibold text-stone-700 mb-3">Parish Identity</h2>
          <label className="block text-xs font-medium text-stone-600 mb-1">
            Display Name
          </label>
          <input
            type="text"
            value={config.parish_display_name}
            onChange={(e) => update("parish_display_name", e.target.value)}
            placeholder="st. monica catholic community"
            className="w-full max-w-md border border-stone-300 rounded-md px-3 py-2 text-sm"
          />
          <p className="text-xs text-stone-400 mt-1">Shown on generated PDFs and worship aids.</p>

          {/* Logo Upload */}
          <div className="mt-4">
            <label className="block text-xs font-medium text-stone-600 mb-1">
              Parish Logo
            </label>
            <div className="flex items-center gap-3">
              {config.logo_url ? (
                <img src={config.logo_url} alt="Logo" className="w-16 h-16 object-contain border border-stone-200 rounded" />
              ) : (
                <div className="w-16 h-16 border border-dashed border-stone-300 rounded flex items-center justify-center text-stone-300 text-xs">
                  No logo
                </div>
              )}
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploadingLogo(true);
                    try {
                      const fd = new FormData();
                      fd.append("file", file);
                      const res = await fetch("/api/brand-config/upload-logo", { method: "POST", body: fd });
                      if (res.ok) {
                        const data = await res.json();
                        update("logo_url", data.logoUrl);
                        update("logo_storage_path", data.storagePath);
                      }
                    } finally {
                      setUploadingLogo(false);
                      e.target.value = "";
                    }
                  }}
                />
                <span className="text-xs px-3 py-1.5 border border-stone-300 text-stone-600 rounded-md hover:bg-stone-50">
                  {uploadingLogo ? "Uploading..." : "Upload Logo"}
                </span>
              </label>
              {config.logo_url && (
                <button
                  onClick={() => { update("logo_url", null); update("logo_storage_path", null); }}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Colors */}
        <section>
          <h2 className="text-sm font-semibold text-stone-700 mb-3">Colors</h2>
          <div className="grid grid-cols-3 gap-4 max-w-md">
            <ColorPicker label="Primary" value={config.primary_color} onChange={(v) => update("primary_color", v)} />
            <ColorPicker label="Secondary" value={config.secondary_color} onChange={(v) => update("secondary_color", v)} />
            <ColorPicker label="Accent" value={config.accent_color} onChange={(v) => update("accent_color", v)} />
          </div>
        </section>

        {/* Fonts */}
        <section>
          <h2 className="text-sm font-semibold text-stone-700 mb-3">Fonts</h2>
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Heading Font</label>
              <select
                value={config.heading_font}
                onChange={(e) => update("heading_font", e.target.value)}
                className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm"
              >
                {FONT_PRESETS.heading.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Body Font</label>
              <select
                value={config.body_font}
                onChange={(e) => update("body_font", e.target.value)}
                className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm"
              >
                {FONT_PRESETS.body.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Layout Preset */}
        <section>
          <h2 className="text-sm font-semibold text-stone-700 mb-3">Layout Preset</h2>
          <div className="grid grid-cols-3 gap-3 max-w-lg">
            {LAYOUT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => update("layout_preset", preset.id)}
                className={`p-3 rounded-lg border-2 text-left transition-colors ${
                  config.layout_preset === preset.id
                    ? "border-stone-900 bg-stone-50"
                    : "border-stone-200 hover:border-stone-400"
                }`}
              >
                <div className="text-sm font-semibold text-stone-800">{preset.name}</div>
                <div className="text-xs text-stone-500 mt-1">{preset.desc}</div>
              </button>
            ))}
          </div>
        </section>

        {/* Cover Style */}
        <section>
          <h2 className="text-sm font-semibold text-stone-700 mb-3">Worship Aid Cover</h2>
          <div className="flex gap-3">
            {(["photo", "gradient", "ai"] as const).map((style) => (
              <button
                key={style}
                onClick={() => update("cover_style", style)}
                className={`px-4 py-2 rounded-md text-sm border transition-colors ${
                  config.cover_style === style
                    ? "border-stone-900 bg-stone-900 text-white"
                    : "border-stone-300 text-stone-600 hover:border-stone-500"
                }`}
              >
                {style === "photo" ? "Photo" : style === "gradient" ? "Gradient" : "AI Generated"}
              </button>
            ))}
          </div>
        </section>

        {/* Header Overlay */}
        <section>
          <h2 className="text-sm font-semibold text-stone-700 mb-3">Sheet Music Header</h2>
          <div className="flex gap-3">
            <button
              onClick={() => update("header_overlay_mode", "banner")}
              className={`px-4 py-2 rounded-md text-sm border transition-colors ${
                config.header_overlay_mode === "banner"
                  ? "border-stone-900 bg-stone-900 text-white"
                  : "border-stone-300 text-stone-600 hover:border-stone-500"
              }`}
            >
              Banner (recommended)
            </button>
            <button
              onClick={() => update("header_overlay_mode", "replace")}
              className={`px-4 py-2 rounded-md text-sm border transition-colors ${
                config.header_overlay_mode === "replace"
                  ? "border-stone-900 bg-stone-900 text-white"
                  : "border-stone-300 text-stone-600 hover:border-stone-500"
              }`}
            >
              Replace (experimental)
            </button>
          </div>
          <p className="text-xs text-stone-400 mt-2">
            Banner adds a branded strip above each reprint. Replace overwrites the original title area (may clip some layouts).
          </p>
        </section>

        {/* Live Preview */}
        <section>
          <h2 className="text-sm font-semibold text-stone-700 mb-3">Preview</h2>
          <div
            className="border border-stone-200 rounded-lg p-6 max-w-md"
            style={{
              fontFamily: `"${config.body_font}", sans-serif`,
            }}
          >
            <div
              className="text-center pb-2 mb-3"
              style={{ borderBottom: `2px solid ${config.accent_color}` }}
            >
              <div
                className="text-[7px] tracking-[3px] uppercase mb-1"
                style={{ color: config.accent_color }}
              >
                {config.parish_display_name || "Your Parish Name"}
              </div>
              <div
                className="text-lg font-bold"
                style={{
                  fontFamily: `"${config.heading_font}", serif`,
                  color: config.primary_color,
                }}
              >
                5th Sunday of Lent
              </div>
              <div className="text-[8px] text-stone-400">
                Sunday, March 29, 2026 &bull; 9:30am &bull; Heritage
              </div>
            </div>
            <div className="space-y-1.5">
              {["Gathering", "Psalm", "Offertory", "Communion", "Sending"].map((pos) => (
                <div key={pos} className="flex gap-2 text-xs border-b border-stone-100 pb-1">
                  <span
                    className="w-16 text-right text-[7px] uppercase tracking-wider pt-0.5"
                    style={{ color: config.accent_color }}
                  >
                    {pos}
                  </span>
                  <span className="font-medium text-stone-700">Sample Song Title</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-stone-600 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded border border-stone-300 cursor-pointer"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 border border-stone-300 rounded px-2 py-1 text-xs font-mono"
        />
      </div>
    </div>
  );
}
