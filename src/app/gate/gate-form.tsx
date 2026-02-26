"use client";

import { useRouter } from "next/navigation";
import { useState, use } from "react";

export function GateForm({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const params = use(searchParams);
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/gate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    if (res.ok) {
      router.push(params.redirect || "/");
      router.refresh();
    } else {
      setError("Invalid access code. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="password"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Access code"
        className="w-full px-4 py-3 rounded-lg bg-stone-800 border border-stone-700 text-white placeholder:text-stone-500 text-center text-lg tracking-widest focus:outline-none focus:border-parish-gold/50 focus:ring-1 focus:ring-parish-gold/50 transition-colors"
        autoFocus
        required
      />
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 rounded-lg bg-parish-burgundy text-white font-semibold hover:bg-parish-burgundy/90 transition-colors disabled:opacity-50"
      >
        {loading ? "Verifying..." : "Enter"}
      </button>
    </form>
  );
}
