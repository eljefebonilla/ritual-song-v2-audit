"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/user-context";

const COMMUNITIES = [
  { id: "reflections", label: "Reflections" },
  { id: "foundations", label: "Foundations" },
  { id: "generations", label: "Generations" },
  { id: "heritage", label: "Heritage" },
  { id: "elevations", label: "Elevations" },
];

const VOICE_PARTS = ["Soprano", "Alto", "Tenor", "Bass"];

interface ProfileData {
  full_name: string;
  email: string;
  phone: string;
  community_id: string;
  voice_part: string;
  instrument: string;
}

export default function ProfilePage() {
  const { user, profile } = useUser();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [formData, setFormData] = useState<ProfileData>({
    full_name: "",
    email: "",
    phone: "",
    community_id: "",
    voice_part: "",
    instrument: "",
  });

  const syncFormFromProfile = useCallback(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name ?? "",
        email: profile.email ?? "",
        phone: profile.phone ?? "",
        community_id: profile.community_id ?? "",
        voice_part: profile.voice_part ?? "",
        instrument: profile.instrument ?? "",
      });
    }
  }, [profile]);

  useEffect(() => {
    syncFormFromProfile();
  }, [syncFormFromProfile]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  function update(field: keyof ProfileData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function handleCancel() {
    syncFormFromProfile();
    setEditing(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: formData.full_name,
        phone: formData.phone || null,
        community_id: formData.community_id || null,
        voice_part: formData.voice_part || null,
        instrument: formData.instrument || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    setLoading(false);

    if (error) {
      setToast({ type: "error", message: "Failed to save profile. Please try again." });
    } else {
      setToast({ type: "success", message: "Profile updated successfully." });
      setEditing(false);
      // Reload the page to refresh the user context with new profile data
      window.location.reload();
    }
  }

  const communityLabel =
    COMMUNITIES.find((c) => c.id === formData.community_id)?.label ?? "Not set";
  const voicePartLabel = formData.voice_part
    ? formData.voice_part.charAt(0).toUpperCase() + formData.voice_part.slice(1)
    : "Not set";

  const inputClass =
    "w-full px-3 py-2 rounded-lg border border-stone-300 text-stone-900 bg-white focus:outline-none focus:border-parish-burgundy focus:ring-1 focus:ring-parish-burgundy disabled:bg-stone-100 disabled:text-stone-500";

  // Loading skeleton
  if (!profile) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-stone-200 rounded w-1/3" />
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex gap-4">
                  <div className="h-4 bg-stone-200 rounded w-1/4" />
                  <div className="h-4 bg-stone-200 rounded w-1/2" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`rounded-lg px-4 py-3 text-sm font-medium flex items-center gap-2 ${
            toast.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {toast.type === "success" ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
          {toast.message}
        </div>
      )}

      {/* Profile Card */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm">
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-900">
            Personal Information
          </h2>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-1.5 text-sm font-medium text-parish-burgundy border border-parish-burgundy/30 rounded-lg hover:bg-parish-burgundy/5 transition-colors"
            >
              Edit Profile
            </button>
          )}
        </div>

        {editing ? (
          /* Edit Mode */
          <form onSubmit={handleSave} className="p-6 space-y-5">
            {/* Full Name */}
            <div>
              <label
                htmlFor="full_name"
                className="block text-sm font-medium text-stone-700 mb-1"
              >
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                id="full_name"
                type="text"
                value={formData.full_name}
                onChange={(e) => update("full_name", e.target.value)}
                className={inputClass}
                required
              />
            </div>

            {/* Email (read-only) */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-stone-700 mb-1"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                className={inputClass}
                disabled
              />
              <p className="mt-1 text-xs text-stone-400">
                Email cannot be changed here. Contact your director for assistance.
              </p>
            </div>

            {/* Phone */}
            <div>
              <label
                htmlFor="phone"
                className="block text-sm font-medium text-stone-700 mb-1"
              >
                Phone
              </label>
              <input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="(555) 123-4567"
                className={inputClass}
              />
            </div>

            {/* Community */}
            <div>
              <label
                htmlFor="community"
                className="block text-sm font-medium text-stone-700 mb-1"
              >
                Community
              </label>
              <select
                id="community"
                value={formData.community_id}
                onChange={(e) => update("community_id", e.target.value)}
                className={inputClass}
              >
                <option value="">Select a community...</option>
                {COMMUNITIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Voice Part & Instrument */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="voice_part"
                  className="block text-sm font-medium text-stone-700 mb-1"
                >
                  Voice Part
                </label>
                <select
                  id="voice_part"
                  value={formData.voice_part}
                  onChange={(e) => update("voice_part", e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select...</option>
                  {VOICE_PARTS.map((v) => (
                    <option key={v} value={v.toLowerCase()}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="instrument"
                  className="block text-sm font-medium text-stone-700 mb-1"
                >
                  Instrument
                </label>
                <input
                  id="instrument"
                  type="text"
                  value={formData.instrument}
                  onChange={(e) => update("instrument", e.target.value)}
                  placeholder="e.g. Piano, Guitar"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 text-sm font-semibold rounded-lg bg-parish-burgundy text-white hover:bg-parish-burgundy/90 transition-colors disabled:opacity-50"
              >
                {loading ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={loading}
                className="px-5 py-2 text-sm font-medium rounded-lg text-stone-600 hover:bg-stone-100 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          /* View Mode */
          <div className="p-6">
            <dl className="divide-y divide-stone-100">
              <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
                <dt className="text-sm font-medium text-stone-500">Full Name</dt>
                <dd className="mt-1 text-sm text-stone-900 sm:col-span-2 sm:mt-0">
                  {formData.full_name || "Not set"}
                </dd>
              </div>
              <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
                <dt className="text-sm font-medium text-stone-500">Email</dt>
                <dd className="mt-1 text-sm text-stone-900 sm:col-span-2 sm:mt-0">
                  {formData.email}
                </dd>
              </div>
              <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
                <dt className="text-sm font-medium text-stone-500">Phone</dt>
                <dd className="mt-1 text-sm text-stone-900 sm:col-span-2 sm:mt-0">
                  {formData.phone || "Not set"}
                </dd>
              </div>
              <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
                <dt className="text-sm font-medium text-stone-500">Community</dt>
                <dd className="mt-1 text-sm text-stone-900 sm:col-span-2 sm:mt-0">
                  {communityLabel}
                </dd>
              </div>
              <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
                <dt className="text-sm font-medium text-stone-500">Voice Part</dt>
                <dd className="mt-1 text-sm text-stone-900 sm:col-span-2 sm:mt-0">
                  {voicePartLabel}
                </dd>
              </div>
              <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
                <dt className="text-sm font-medium text-stone-500">Instrument</dt>
                <dd className="mt-1 text-sm text-stone-900 sm:col-span-2 sm:mt-0">
                  {formData.instrument || "Not set"}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}
