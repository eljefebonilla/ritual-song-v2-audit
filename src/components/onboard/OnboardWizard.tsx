"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { completeOnboarding } from "@/app/onboard/actions";
import Link from "next/link";

const TOTAL_STEPS = 4;

const ENSEMBLES = [
  {
    id: "reflections",
    label: "Reflections",
    desc: "Contemporary worship",
  },
  {
    id: "foundations",
    label: "Foundations",
    desc: "Traditional music",
  },
  {
    id: "generations",
    label: "Generations",
    desc: "Youth ensemble",
  },
  {
    id: "heritage",
    label: "Heritage",
    desc: "Spanish-language",
  },
  {
    id: "elevations",
    label: "Elevations",
    desc: "Gospel / spiritual",
  },
];

const ROLES = [
  { id: "vocalist", label: "Vocalist", icon: "note" },
  { id: "instrumentalist", label: "Instrumentalist", icon: "guitar" },
  { id: "cantor", label: "Cantor", icon: "mic" },
  { id: "both", label: "Both", icon: "combined" },
];

const VOICE_PARTS = [
  { id: "soprano", label: "Soprano" },
  { id: "alto", label: "Alto" },
  { id: "tenor", label: "Tenor" },
  { id: "bass", label: "Bass" },
];

function RoleIcon({ type, className }: { type: string; className?: string }) {
  const cls = className || "w-6 h-6";
  switch (type) {
    case "note":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
        </svg>
      );
    case "guitar":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 4l-3 3" /><path d="M14.5 9.5a3.5 3.5 0 0 0-5 5L4 20l1 1 5.5-5.5a3.5 3.5 0 0 0 5-5z" />
        </svg>
      );
    case "mic":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      );
    case "combined":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" />
          <path d="M19 10v1a4 4 0 0 1-4 4" />
        </svg>
      );
    default:
      return null;
  }
}

interface ExistingProfile {
  musicianRole: string;
  voicePart: string;
  instrumentDetail: string;
  ensemble: string;
}

interface OnboardWizardProps {
  userId: string;
  defaultEmail: string;
  defaultPhone: string;
  defaultName: string;
  inviteCode: string | null;
  inviteEnsemble: string | null;
  existingProfile: ExistingProfile | null;
}

export function OnboardWizard({
  userId,
  defaultEmail,
  defaultPhone,
  defaultName,
  inviteCode,
  inviteEnsemble,
  existingProfile,
}: OnboardWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    fullName: defaultName,
    email: defaultEmail,
    phone: defaultPhone,
    musicianRole: existingProfile?.musicianRole || "",
    voicePart: existingProfile?.voicePart || "",
    instrumentDetail: existingProfile?.instrumentDetail || "",
    ensemble: inviteEnsemble || existingProfile?.ensemble || "",
    smsConsent: false,
  });

  function update(field: string, value: string | boolean) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function goForward() {
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 1));
  }

  const showVoicePart = ["vocalist", "cantor", "both"].includes(
    formData.musicianRole
  );
  const showInstrument = ["instrumentalist", "both"].includes(
    formData.musicianRole
  );

  async function handleSubmit() {
    setError("");
    setLoading(true);

    const result = await completeOnboarding({
      userId,
      fullName: formData.fullName,
      email: formData.email,
      phone: formData.phone,
      musicianRole: formData.musicianRole,
      voicePart: showVoicePart ? formData.voicePart || null : null,
      instrumentDetail: showInstrument
        ? formData.instrumentDetail || null
        : null,
      ensemble: formData.ensemble,
      smsConsent: formData.smsConsent,
      inviteCode,
    });

    setLoading(false);

    if (!result.success) {
      setError(result.error || "Something went wrong. Please try again.");
      return;
    }

    router.push("/pending");
    router.refresh();
  }

  // Step validation
  function canAdvance(): boolean {
    switch (step) {
      case 1:
        return !!formData.fullName.trim();
      case 2:
        return !!formData.musicianRole;
      case 3:
        return !!formData.ensemble;
      case 4:
        return true;
      default:
        return false;
    }
  }

  const inputClass =
    "w-full px-4 py-3 rounded-lg border border-stone-300 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 text-base bg-white";

  return (
    <div>
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div
            key={i}
            className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
              i + 1 <= step
                ? "bg-violet-600"
                : "bg-stone-300"
            }`}
          />
        ))}
      </div>

      {/* Step content with CSS transition */}
      <div className="relative overflow-hidden">
        <div
          key={step}
          className="onboard-step-enter"
        >
          {/* Step 1: Welcome + Name */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold text-stone-900">
                  Welcome to St. Monica Music Ministry
                </h2>
                <p className="text-sm text-stone-500 mt-1">
                  Let&apos;s get you set up.
                </p>
              </div>

              <div>
                <label
                  htmlFor="fullName"
                  className="block text-sm font-medium text-stone-700 mb-1.5"
                >
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => update("fullName", e.target.value)}
                  placeholder="Your name"
                  className={inputClass}
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  className={`${inputClass} bg-stone-100 text-stone-500`}
                  disabled
                />
              </div>

              {!defaultPhone && (
                <div>
                  <label
                    htmlFor="phone"
                    className="block text-sm font-medium text-stone-700 mb-1.5"
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
              )}
            </div>
          )}

          {/* Step 2: Your Role */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold text-stone-900">
                  What do you do?
                </h2>
                <p className="text-sm text-stone-500 mt-1">
                  Select your primary role.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {ROLES.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => update("musicianRole", role.id)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all min-h-[80px] ${
                      formData.musicianRole === role.id
                        ? "border-violet-600 bg-violet-50 text-violet-900"
                        : "border-stone-200 bg-white text-stone-700 hover:border-stone-300"
                    }`}
                  >
                    <RoleIcon
                      type={role.icon}
                      className={`w-6 h-6 ${
                        formData.musicianRole === role.id
                          ? "text-violet-600"
                          : "text-stone-400"
                      }`}
                    />
                    <span className="text-sm font-medium">{role.label}</span>
                  </button>
                ))}
              </div>

              {/* Voice part cards */}
              {showVoicePart && (
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    Voice Part
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {VOICE_PARTS.map((vp) => (
                      <button
                        key={vp.id}
                        type="button"
                        onClick={() => update("voicePart", vp.id)}
                        className={`py-3 px-2 rounded-lg border-2 text-sm font-medium transition-all ${
                          formData.voicePart === vp.id
                            ? "border-violet-600 bg-violet-50 text-violet-900"
                            : "border-stone-200 bg-white text-stone-600 hover:border-stone-300"
                        }`}
                      >
                        {vp.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Instrument input */}
              {showInstrument && (
                <div>
                  <label
                    htmlFor="instrumentDetail"
                    className="block text-sm font-medium text-stone-700 mb-1.5"
                  >
                    What instrument(s) do you play?
                  </label>
                  <input
                    id="instrumentDetail"
                    type="text"
                    value={formData.instrumentDetail}
                    onChange={(e) =>
                      update("instrumentDetail", e.target.value)
                    }
                    placeholder="e.g. Piano, Guitar, Violin"
                    className={inputClass}
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 3: Your Ensemble */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold text-stone-900">
                  Which group are you joining?
                </h2>
                <p className="text-sm text-stone-500 mt-1">
                  You can always change this later.
                </p>
              </div>

              <div className="space-y-3">
                {ENSEMBLES.map((ens) => (
                  <button
                    key={ens.id}
                    type="button"
                    onClick={() => update("ensemble", ens.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                      formData.ensemble === ens.id
                        ? "border-violet-600 bg-violet-50"
                        : "border-stone-200 bg-white hover:border-stone-300"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                        formData.ensemble === ens.id
                          ? "bg-violet-600 text-white"
                          : "bg-stone-100 text-stone-500"
                      }`}
                    >
                      {ens.label[0]}
                    </div>
                    <div>
                      <div
                        className={`font-medium ${
                          formData.ensemble === ens.id
                            ? "text-violet-900"
                            : "text-stone-900"
                        }`}
                      >
                        {ens.label}
                      </div>
                      <div className="text-sm text-stone-500">{ens.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Stay Connected + Submit */}
          {step === 4 && (
            <div className="space-y-5">
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold text-stone-900">
                  Stay Connected
                </h2>
                <p className="text-sm text-stone-500 mt-1">
                  Almost done! One last thing.
                </p>
              </div>

              <label className="flex items-start gap-3 p-4 rounded-xl border border-stone-200 bg-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.smsConsent}
                  onChange={(e) => update("smsConsent", e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-stone-300 text-violet-600 focus:ring-violet-500 shrink-0"
                />
                <span className="text-sm text-stone-600 leading-relaxed">
                  I agree to receive text messages from St. Monica Music
                  Ministry. Message and data rates may apply. Reply STOP to
                  unsubscribe.
                </span>
              </label>

              {/* Summary */}
              <div className="p-4 rounded-xl bg-stone-100 space-y-2">
                <h3 className="text-sm font-medium text-stone-700">
                  Your info
                </h3>
                <div className="text-sm text-stone-600 space-y-1">
                  <p>
                    <span className="text-stone-400">Name:</span>{" "}
                    {formData.fullName}
                  </p>
                  <p>
                    <span className="text-stone-400">Role:</span>{" "}
                    {ROLES.find((r) => r.id === formData.musicianRole)?.label}
                    {formData.voicePart &&
                      ` / ${VOICE_PARTS.find((v) => v.id === formData.voicePart)?.label}`}
                  </p>
                  <p>
                    <span className="text-stone-400">Ensemble:</span>{" "}
                    {ENSEMBLES.find((e) => e.id === formData.ensemble)?.label}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="mt-8 flex items-center gap-3">
        {step > 1 && (
          <button
            type="button"
            onClick={goBack}
            className="px-5 py-3 rounded-lg text-stone-600 font-medium hover:bg-stone-100 transition-colors"
          >
            Back
          </button>
        )}
        <div className="flex-1" />
        {step < TOTAL_STEPS ? (
          <button
            type="button"
            onClick={goForward}
            disabled={!canAdvance()}
            className="px-8 py-3 rounded-lg bg-violet-600 text-white font-semibold hover:bg-violet-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="px-8 py-3 rounded-lg bg-violet-600 text-white font-semibold hover:bg-violet-700 transition-colors disabled:opacity-50"
          >
            {loading ? "Joining..." : "Join"}
          </button>
        )}
      </div>

      {/* Footer links */}
      <div className="mt-6 flex items-center justify-center gap-4 text-[11px] text-stone-400">
        <Link
          href="/privacy"
          className="hover:text-stone-600 transition-colors"
        >
          Privacy
        </Link>
        <span>|</span>
        <Link
          href="/terms"
          className="hover:text-stone-600 transition-colors"
        >
          Terms
        </Link>
      </div>

    </div>
  );
}
