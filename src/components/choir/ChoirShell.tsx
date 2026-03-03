"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/user-context";
import type { ChoirSignup, VoicePart, ChoirSummary } from "@/lib/booking-types";
import MassSignupCard from "./MassSignupCard";

interface MassEvent {
  id: string;
  title: string;
  event_date: string;
  start_time_12h: string;
  ensemble: string | null;
  choir_descriptor: string | null;
  liturgical_name: string | null;
  occasion_id: string | null;
  celebrant: string | null;
  day_of_week: string | null;
  season: string | null;
}

interface ChoirShellProps {
  masses: MassEvent[];
  signups: ChoirSignup[];
}

function buildChoirSummary(
  signups: ChoirSignup[],
  descriptor: string | null
): ChoirSummary {
  const confirmed = signups.filter((s) => s.status === "confirmed");
  const roster: Record<VoicePart, ChoirSignup[]> = {
    Soprano: [],
    Alto: [],
    Tenor: [],
    Bass: [],
  };
  for (const s of confirmed) {
    roster[s.voice_part]?.push(s);
  }
  const soprano = roster.Soprano.length;
  const alto = roster.Alto.length;
  const tenor = roster.Tenor.length;
  const bass = roster.Bass.length;
  const total = soprano + alto + tenor + bass;
  const parts = [
    soprano && `${soprano}S`,
    alto && `${alto}A`,
    tenor && `${tenor}T`,
    bass && `${bass}B`,
  ]
    .filter(Boolean)
    .join(", ");
  const label = descriptor || "Volunteers";
  const display = total > 0 ? `${label} [${parts}]` : label;
  return { total, soprano, alto, tenor, bass, display, roster };
}

function formatDateHeading(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function ChoirShell({ masses, signups }: ChoirShellProps) {
  const { user, profile, isAuthenticated } = useUser();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  // Group signups by mass_event_id
  const signupsByMass = useMemo(() => {
    const map = new Map<string, ChoirSignup[]>();
    for (const s of signups) {
      const list = map.get(s.mass_event_id) || [];
      list.push(s);
      map.set(s.mass_event_id, list);
    }
    return map;
  }, [signups]);

  // Find current user's signups
  const mySignups = useMemo(() => {
    if (!user) return new Map<string, ChoirSignup>();
    const map = new Map<string, ChoirSignup>();
    for (const s of signups) {
      if (s.user_id === user.id) {
        map.set(s.mass_event_id, s);
      }
    }
    return map;
  }, [signups, user]);

  const handleSignUp = useCallback(
    async (massEventId: string, voicePart: VoicePart) => {
      setLoading(massEventId);
      try {
        const res = await fetch("/api/choir-signups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mass_event_id: massEventId, voice_part: voicePart }),
        });
        if (res.ok) {
          router.refresh();
        }
      } finally {
        setLoading(null);
      }
    },
    [router]
  );

  const handleCancel = useCallback(
    async (signupId: string, massEventId: string) => {
      setLoading(massEventId);
      try {
        const res = await fetch(`/api/choir-signups/${signupId}`, {
          method: "DELETE",
        });
        if (res.ok) {
          router.refresh();
        }
      } finally {
        setLoading(null);
      }
    },
    [router]
  );

  const handleChangeVoicePart = useCallback(
    async (signupId: string, massEventId: string, voicePart: VoicePart) => {
      setLoading(massEventId);
      try {
        const res = await fetch(`/api/choir-signups/${signupId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ voice_part: voicePart }),
        });
        if (res.ok) {
          router.refresh();
        }
      } finally {
        setLoading(null);
      }
    },
    [router]
  );

  // Group masses by date
  const massesByDate = useMemo(() => {
    const map = new Map<string, MassEvent[]>();
    for (const m of masses) {
      const list = map.get(m.event_date) || [];
      list.push(m);
      map.set(m.event_date, list);
    }
    return map;
  }, [masses]);

  const sortedDates = useMemo(
    () => Array.from(massesByDate.keys()).sort(),
    [massesByDate]
  );

  const defaultVoicePart = (profile?.voice_part as VoicePart) || null;

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="shrink-0 border-b border-stone-200 bg-white px-4 py-3 md:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-stone-900">Choir Sign-Up</h1>
            <p className="text-xs text-stone-500 mt-0.5">
              Sign up for upcoming Masses that need choir volunteers
            </p>
          </div>
          {isAuthenticated && defaultVoicePart && (
            <span className="text-xs px-2 py-1 bg-stone-100 text-stone-600 rounded-md font-medium">
              {defaultVoicePart}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {masses.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-stone-400">
            <div className="text-center">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mx-auto mb-3 text-stone-300"
              >
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
              <p className="text-sm">No upcoming Masses need choir volunteers</p>
              <p className="text-xs mt-1">Check back later for new openings</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {sortedDates.map((date) => {
              const dateMasses = massesByDate.get(date) || [];
              return (
                <div key={date} className="py-3">
                  {/* Date heading */}
                  <div className="flex items-center gap-2 px-4 md:px-6 py-1">
                    <span className="text-xs font-medium text-stone-600">
                      {formatDateHeading(date)}
                    </span>
                    <div className="flex-1 h-px bg-stone-100" />
                  </div>

                  {/* Mass cards for this date */}
                  <div className="mt-1 space-y-1 px-2 md:px-4">
                    {dateMasses.map((mass) => {
                      const massSignups = signupsByMass.get(mass.id) || [];
                      const mySignup = mySignups.get(mass.id) || null;
                      const summary = buildChoirSummary(
                        massSignups,
                        mass.choir_descriptor
                      );
                      return (
                        <MassSignupCard
                          key={mass.id}
                          mass={mass}
                          summary={summary}
                          mySignup={mySignup}
                          defaultVoicePart={defaultVoicePart}
                          isAuthenticated={isAuthenticated}
                          isLoading={loading === mass.id}
                          onSignUp={(vp) => handleSignUp(mass.id, vp)}
                          onCancel={() =>
                            mySignup && handleCancel(mySignup.id, mass.id)
                          }
                          onChangeVoicePart={(vp) =>
                            mySignup &&
                            handleChangeVoicePart(mySignup.id, mass.id, vp)
                          }
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
