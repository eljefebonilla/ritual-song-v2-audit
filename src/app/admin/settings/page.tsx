"use client";

import { useState, useEffect } from "react";

interface SettingsData {
  parish_name?: string;
  diocese?: string;
  zip_code?: string;
  ascension_transferred_to_sunday?: boolean;
  epiphany_transferred_to_sunday?: boolean;
  assumption_obligation_abrogated_on_saturday?: boolean;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SettingsData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setSettings(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Settings saved." });
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to save." });
      }
    } catch {
      setMessage({ type: "error", text: "Network error." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 pt-14 md:p-8 md:pt-8 max-w-2xl">
        <h1 className="text-2xl font-bold text-stone-900 mb-4">Settings</h1>
        <p className="text-stone-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-4 pt-14 md:p-8 md:pt-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-stone-900 mb-1">Settings</h1>
      <p className="text-sm text-stone-500 mb-6">
        Parish configuration and liturgical calendar settings.
      </p>

      <div className="space-y-6">
        {/* Parish info */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wide">
            Parish Information
          </h2>

          <div>
            <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">
              Parish Name
            </label>
            <input
              type="text"
              value={settings.parish_name || ""}
              onChange={(e) =>
                setSettings({ ...settings, parish_name: e.target.value })
              }
              className="w-full text-sm border border-stone-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-stone-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">
              Diocese
            </label>
            <input
              type="text"
              value={settings.diocese || ""}
              onChange={(e) =>
                setSettings({ ...settings, diocese: e.target.value })
              }
              className="w-full text-sm border border-stone-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-stone-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">
              Zip Code
            </label>
            <input
              type="text"
              value={settings.zip_code || ""}
              onChange={(e) =>
                setSettings({ ...settings, zip_code: e.target.value })
              }
              className="w-full text-sm border border-stone-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-stone-400"
              maxLength={10}
            />
          </div>
        </section>

        {/* Transfer settings */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wide">
            Liturgical Calendar Transfers
          </h2>
          <p className="text-xs text-stone-400">
            These settings affect how certain solemnities are observed in your diocese.
          </p>

          <label className="flex items-start gap-3 cursor-pointer py-2">
            <input
              type="checkbox"
              checked={settings.ascension_transferred_to_sunday ?? true}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  ascension_transferred_to_sunday: e.target.checked,
                })
              }
              className="mt-0.5 rounded border-stone-300 text-parish-burgundy focus:ring-parish-burgundy"
            />
            <div>
              <span className="text-sm text-stone-700">
                Ascension transferred to Sunday
              </span>
              <p className="text-xs text-stone-400 mt-0.5">
                Most US dioceses transfer Ascension from Thursday to the 7th Sunday of Easter.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer py-2">
            <input
              type="checkbox"
              checked={settings.epiphany_transferred_to_sunday ?? true}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  epiphany_transferred_to_sunday: e.target.checked,
                })
              }
              className="mt-0.5 rounded border-stone-300 text-parish-burgundy focus:ring-parish-burgundy"
            />
            <div>
              <span className="text-sm text-stone-700">
                Epiphany transferred to Sunday
              </span>
              <p className="text-xs text-stone-400 mt-0.5">
                In the US, Epiphany is celebrated on the Sunday between Jan 2-8.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer py-2">
            <input
              type="checkbox"
              checked={
                settings.assumption_obligation_abrogated_on_saturday ?? true
              }
              onChange={(e) =>
                setSettings({
                  ...settings,
                  assumption_obligation_abrogated_on_saturday: e.target.checked,
                })
              }
              className="mt-0.5 rounded border-stone-300 text-parish-burgundy focus:ring-parish-burgundy"
            />
            <div>
              <span className="text-sm text-stone-700">
                Assumption obligation abrogated on Saturday
              </span>
              <p className="text-xs text-stone-400 mt-0.5">
                When Aug 15 falls on Saturday, the obligation is abrogated in many US dioceses.
              </p>
            </div>
          </label>
        </section>

        {/* Save */}
        <div className="flex items-center gap-3 pt-4 border-t border-stone-200">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 text-sm font-medium text-white bg-stone-900 rounded-md hover:bg-stone-800 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>

          {message && (
            <p
              className={`text-sm ${
                message.type === "success" ? "text-green-700" : "text-red-600"
              }`}
            >
              {message.text}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
