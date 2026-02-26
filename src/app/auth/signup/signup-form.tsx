"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const COMMUNITIES = [
  { id: "reflections", label: "Reflections" },
  { id: "foundations", label: "Foundations" },
  { id: "generations", label: "Generations" },
  { id: "heritage", label: "Heritage" },
  { id: "elevations", label: "Elevations" },
];

const VOICE_PARTS = ["Soprano", "Alto", "Tenor", "Bass"];

export function SignupForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    phone: "",
    voicePart: "",
    instrument: "",
    communityId: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();

    // Create auth account
    const { data, error: authError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          full_name: formData.fullName,
        },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Create profile
    if (data.user) {
      const { error: profileError } = await supabase.from("profiles").insert({
        id: data.user.id,
        full_name: formData.fullName,
        email: formData.email,
        phone: formData.phone || null,
        voice_part: formData.voicePart || null,
        instrument: formData.instrument || null,
        community_id: formData.communityId || null,
        role: "member",
      });

      if (profileError) {
        setError("Account created but profile setup failed. Please contact your director.");
        setLoading(false);
        return;
      }
    }

    router.push("/");
    router.refresh();
  }

  const inputClass =
    "w-full px-3 py-2 rounded-lg border border-stone-300 text-stone-900 focus:outline-none focus:border-parish-burgundy focus:ring-1 focus:ring-parish-burgundy";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div>
        <label htmlFor="fullName" className="block text-sm font-medium text-stone-700 mb-1">
          Full Name <span className="text-red-500">*</span>
        </label>
        <input
          id="fullName"
          type="text"
          value={formData.fullName}
          onChange={(e) => update("fullName", e.target.value)}
          className={inputClass}
          required
        />
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-stone-700 mb-1">
          Email <span className="text-red-500">*</span>
        </label>
        <input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => update("email", e.target.value)}
          className={inputClass}
          required
        />
      </div>

      {/* Password */}
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-stone-700 mb-1">
          Password <span className="text-red-500">*</span>
        </label>
        <input
          id="password"
          type="password"
          value={formData.password}
          onChange={(e) => update("password", e.target.value)}
          className={inputClass}
          minLength={6}
          required
        />
      </div>

      {/* Phone */}
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-stone-700 mb-1">
          Phone
        </label>
        <input
          id="phone"
          type="tel"
          value={formData.phone}
          onChange={(e) => update("phone", e.target.value)}
          className={inputClass}
        />
      </div>

      {/* Community */}
      <div>
        <label htmlFor="community" className="block text-sm font-medium text-stone-700 mb-1">
          Community
        </label>
        <select
          id="community"
          value={formData.communityId}
          onChange={(e) => update("communityId", e.target.value)}
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

      {/* Voice Part & Instrument (side by side) */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="voicePart" className="block text-sm font-medium text-stone-700 mb-1">
            Voice Part
          </label>
          <select
            id="voicePart"
            value={formData.voicePart}
            onChange={(e) => update("voicePart", e.target.value)}
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
          <label htmlFor="instrument" className="block text-sm font-medium text-stone-700 mb-1">
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

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 rounded-lg bg-parish-burgundy text-white font-semibold hover:bg-parish-burgundy/90 transition-colors disabled:opacity-50"
      >
        {loading ? "Creating account..." : "Create Account"}
      </button>
    </form>
  );
}
