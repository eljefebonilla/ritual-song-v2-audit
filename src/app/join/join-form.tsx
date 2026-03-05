"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState, useRef } from "react";

type AuthMode = "email" | "phone";
type PhoneStep = "input" | "verify";

export function JoinForm({ inviteCode }: { inviteCode?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Email state
  const [email, setEmail] = useState("");

  // Phone state
  const [phone, setPhone] = useState("");
  const [phoneStep, setPhoneStep] = useState<PhoneStep>("input");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  function switchMode(newMode: AuthMode) {
    setMode(newMode);
    setError("");
    setSuccess("");
    setPhoneStep("input");
    setOtp(["", "", "", "", "", ""]);
  }

  function cleanPhone(raw: string): string {
    return raw.replace(/\D/g, "");
  }

  // ---- Email: send magic link ----
  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${
      inviteCode ? `/onboard?invite=${inviteCode}` : "/onboard"
    }`;

    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });

    setLoading(false);
    if (authError) {
      setError(authError.message);
    } else {
      setSuccess("Check your email for a login link.");
    }
  }

  // ---- Phone: send OTP ----
  async function handlePhoneSend(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const cleaned = cleanPhone(phone);
    if (cleaned.length < 10) {
      setError("Please enter a valid 10-digit phone number.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOtp({
      phone: `+1${cleaned}`,
    });

    setLoading(false);
    if (authError) {
      setError(authError.message);
    } else {
      setPhoneStep("verify");
    }
  }

  // ---- Phone: verify OTP ----
  async function handlePhoneVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const token = otp.join("");
    if (token.length !== 6) {
      setError("Please enter the full 6-digit code.");
      setLoading(false);
      return;
    }

    const cleaned = cleanPhone(phone);
    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.verifyOtp({
      phone: `+1${cleaned}`,
      token,
      type: "sms",
    });

    setLoading(false);
    if (authError) {
      setError(authError.message);
      return;
    }

    // Check if existing active user
    if (data.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("status")
        .eq("id", data.user.id)
        .single();

      if (profile?.status === "active") {
        router.push("/");
      } else if (profile?.status === "pending") {
        router.push("/pending");
      } else {
        router.push(inviteCode ? `/onboard?invite=${inviteCode}` : "/onboard");
      }
      router.refresh();
    }
  }

  function handleOtpChange(index: number, value: string) {
    if (value.length > 1) {
      // Paste handling: distribute digits across inputs
      const digits = value.replace(/\D/g, "").slice(0, 6);
      const newOtp = [...otp];
      for (let i = 0; i < digits.length && index + i < 6; i++) {
        newOtp[index + i] = digits[i];
      }
      setOtp(newOtp);
      const nextIndex = Math.min(index + digits.length, 5);
      otpRefs.current[nextIndex]?.focus();
      return;
    }

    const digit = value.replace(/\D/g, "");
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  const inputClass =
    "w-full px-4 py-3 rounded-lg border border-stone-300 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 text-base";

  return (
    <div>
      {/* Mode toggle */}
      <div className="flex bg-stone-100 rounded-lg p-1 mb-6">
        <button
          type="button"
          onClick={() => switchMode("email")}
          className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-colors ${
            mode === "email"
              ? "bg-white text-stone-900 shadow-sm"
              : "text-stone-500 hover:text-stone-700"
          }`}
        >
          Email
        </button>
        <button
          type="button"
          onClick={() => switchMode("phone")}
          className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-colors ${
            mode === "phone"
              ? "bg-white text-stone-900 shadow-sm"
              : "text-stone-500 hover:text-stone-700"
          }`}
        >
          Phone
        </button>
      </div>

      {/* Email mode */}
      {mode === "email" && (
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className={inputClass}
            required
            autoFocus
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-violet-600 text-white font-semibold hover:bg-violet-700 transition-colors disabled:opacity-50 text-base"
          >
            {loading ? "Sending..." : "Send Magic Link"}
          </button>
        </form>
      )}

      {/* Phone mode — input step */}
      {mode === "phone" && phoneStep === "input" && (
        <form onSubmit={handlePhoneSend} className="space-y-4">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500 text-base">
              +1
            </span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
              className={`${inputClass} pl-12`}
              required
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-violet-600 text-white font-semibold hover:bg-violet-700 transition-colors disabled:opacity-50 text-base"
          >
            {loading ? "Sending..." : "Send Code"}
          </button>
        </form>
      )}

      {/* Phone mode — verify step */}
      {mode === "phone" && phoneStep === "verify" && (
        <form onSubmit={handlePhoneVerify} className="space-y-4">
          <p className="text-sm text-stone-600">
            Enter the 6-digit code sent to your phone.
          </p>
          <div className="flex gap-2 justify-center">
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { otpRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={digit}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(i, e)}
                className="w-11 h-[52px] text-center text-xl font-semibold rounded-lg border border-stone-300 text-stone-900 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                autoFocus={i === 0}
              />
            ))}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-violet-600 text-white font-semibold hover:bg-violet-700 transition-colors disabled:opacity-50 text-base"
          >
            {loading ? "Verifying..." : "Verify"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPhoneStep("input");
              setOtp(["", "", "", "", "", ""]);
              setError("");
            }}
            className="w-full text-sm text-stone-500 hover:text-stone-700 transition-colors"
          >
            Use a different number
          </button>
        </form>
      )}

      {/* Success message */}
      {success && (
        <div className="mt-4 p-3 rounded-lg bg-green-50 border border-green-200">
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
    </div>
  );
}
