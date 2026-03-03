"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const ENSEMBLES = [
  { id: "reflections", label: "Reflections" },
  { id: "foundations", label: "Foundations" },
  { id: "generations", label: "Generations" },
  { id: "heritage", label: "Heritage" },
  { id: "elevations", label: "Elevations" },
];

const MUSICIAN_ROLES = [
  { id: "vocalist", label: "Vocalist" },
  { id: "instrumentalist", label: "Instrumentalist" },
  { id: "cantor", label: "Cantor" },
  { id: "both", label: "Vocalist + Instrumentalist" },
];

const VOICE_PARTS = ["Soprano", "Alto", "Tenor", "Bass"];

export function SignupForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    phone: "",
    musicianRole: "vocalist",
    voicePart: "",
    instrumentDetail: "",
    ensembleId: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  const showVoicePart = ["vocalist", "cantor", "both"].includes(formData.musicianRole);
  const showInstrument = ["instrumentalist", "both"].includes(formData.musicianRole);

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
        musician_role: formData.musicianRole,
        voice_part: showVoicePart ? (formData.voicePart || null) : null,
        instrument: showInstrument ? (formData.instrumentDetail || null) : null,
        instrument_detail: showInstrument ? (formData.instrumentDetail || null) : null,
        ensemble: formData.ensembleId || null,
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

      {/* Ensemble */}
      <div>
        <label htmlFor="ensemble" className="block text-sm font-medium text-stone-700 mb-1">
          Ensemble
        </label>
        <select
          id="ensemble"
          value={formData.ensembleId}
          onChange={(e) => update("ensembleId", e.target.value)}
          className={inputClass}
        >
          <option value="">Select an ensemble...</option>
          {ENSEMBLES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Musician Role */}
      <div>
        <label htmlFor="musicianRole" className="block text-sm font-medium text-stone-700 mb-1">
          Musician Role <span className="text-red-500">*</span>
        </label>
        <select
          id="musicianRole"
          value={formData.musicianRole}
          onChange={(e) => update("musicianRole", e.target.value)}
          className={inputClass}
        >
          {MUSICIAN_ROLES.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {/* Voice Part (conditional) */}
      {showVoicePart && (
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
      )}

      {/* Instrument (conditional) */}
      {showInstrument && (
        <div>
          <label htmlFor="instrumentDetail" className="block text-sm font-medium text-stone-700 mb-1">
            Instrument
          </label>
          <input
            id="instrumentDetail"
            type="text"
            value={formData.instrumentDetail}
            onChange={(e) => update("instrumentDetail", e.target.value)}
            placeholder="e.g. Piano, Guitar, Violin"
            className={inputClass}
          />
        </div>
      )}

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
