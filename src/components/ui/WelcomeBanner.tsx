"use client";

import { useState } from "react";
import Link from "next/link";

export default function WelcomeBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="mb-6 bg-gradient-to-r from-green-50 to-parish-gold/10 border border-green-200 rounded-xl p-5 relative">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 text-stone-400 hover:text-stone-600"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      <h2 className="font-serif text-lg font-semibold text-green-900 mb-1">
        Welcome to Ritual Song!
      </h2>
      <p className="text-sm text-green-800 mb-3">
        Your parish is set up and your plan is ready. Here's how to get started:
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Link
          href="/planner"
          className="bg-white rounded-lg border border-green-200 p-3 hover:shadow-sm transition-shadow"
        >
          <p className="text-xs font-semibold text-green-700 mb-0.5">1. Review Your Plan</p>
          <p className="text-xs text-stone-500">See the auto-generated song selections in the planner grid.</p>
        </Link>
        <Link
          href="/admin/booking"
          className="bg-white rounded-lg border border-green-200 p-3 hover:shadow-sm transition-shadow"
        >
          <p className="text-xs font-semibold text-green-700 mb-0.5">2. Book Musicians</p>
          <p className="text-xs text-stone-500">Assign musicians to upcoming Masses in the booking grid.</p>
        </Link>
        <Link
          href="/admin/members"
          className="bg-white rounded-lg border border-green-200 p-3 hover:shadow-sm transition-shadow"
        >
          <p className="text-xs font-semibold text-green-700 mb-0.5">3. Invite Your Team</p>
          <p className="text-xs text-stone-500">Add musicians and staff so they can view schedules and sign up.</p>
        </Link>
      </div>
    </div>
  );
}
