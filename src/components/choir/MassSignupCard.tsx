"use client";

import { useState } from "react";
import Link from "next/link";
import type { ChoirSignup, ChoirSummary, VoicePart } from "@/lib/booking-types";
import { getEnsembleColor } from "@/lib/calendar-utils";
import MassComments from "@/components/comments/MassComments";

const VOICE_PARTS: VoicePart[] = ["Soprano", "Alto", "Tenor", "Bass"];
const PART_ABBREV: Record<VoicePart, string> = {
  Soprano: "S",
  Alto: "A",
  Tenor: "T",
  Bass: "B",
};

interface MassSignupCardProps {
  mass: {
    id: string;
    title: string;
    start_time_12h: string;
    ensemble: string | null;
    choir_descriptor: string | null;
    liturgical_name: string | null;
    occasion_id: string | null;
    celebrant: string | null;
    season: string | null;
  };
  summary: ChoirSummary;
  mySignup: ChoirSignup | null;
  defaultVoicePart: VoicePart | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  onSignUp: (voicePart: VoicePart) => void;
  onCancel: () => void;
  onChangeVoicePart: (voicePart: VoicePart) => void;
}

export default function MassSignupCard({
  mass,
  summary,
  mySignup,
  defaultVoicePart,
  isAuthenticated,
  isLoading,
  onSignUp,
  onCancel,
  onChangeVoicePart,
}: MassSignupCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showPartPicker, setShowPartPicker] = useState(false);
  const ensembleStyle = getEnsembleColor(mass.ensemble);
  const isSignedUp = mySignup !== null;

  const handleSignUp = () => {
    if (defaultVoicePart) {
      onSignUp(defaultVoicePart);
    } else {
      setShowPartPicker(true);
    }
  };

  return (
    <div
      className={`rounded-lg border transition-colors ${
        isSignedUp
          ? "border-green-200 bg-green-50/50"
          : "border-stone-200 bg-white"
      }`}
    >
      {/* Main row */}
      <div className="flex items-start gap-3 px-3 py-2.5">
        {/* Time */}
        <div className="w-16 shrink-0 text-right pt-0.5">
          <span className="text-xs font-medium text-stone-500 tabular-nums">
            {mass.start_time_12h}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-stone-900">
              {mass.liturgical_name || mass.title}
            </span>
            {mass.ensemble && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                style={ensembleStyle}
              >
                {mass.ensemble}
              </span>
            )}
            {mass.choir_descriptor && (
              <span className="text-[10px] px-1.5 py-0.5 bg-stone-100 text-stone-500 rounded font-medium">
                {mass.choir_descriptor}
              </span>
            )}
          </div>

          {/* SATB summary */}
          {summary.total > 0 && (
            <div className="flex items-center gap-1.5 mt-1">
              {VOICE_PARTS.map((part) => {
                const count = summary.roster[part].length;
                if (count === 0) return null;
                return (
                  <span
                    key={part}
                    className="text-[10px] px-1.5 py-0.5 bg-stone-100 text-stone-600 rounded tabular-nums"
                  >
                    {count}{PART_ABBREV[part]}
                  </span>
                );
              })}
              <span className="text-[10px] text-stone-400">
                ({summary.total} total)
              </span>
            </div>
          )}

          {mass.celebrant && (
            <span className="text-xs text-stone-400 mt-0.5 block">
              {mass.celebrant}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="shrink-0 flex items-center gap-2 pt-0.5">
          {isAuthenticated ? (
            isSignedUp ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-green-700">
                  {mySignup!.voice_part}
                </span>
                <button
                  onClick={onCancel}
                  disabled={isLoading}
                  className="text-xs text-stone-400 hover:text-red-600 transition-colors disabled:opacity-50"
                  title="Cancel signup"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={handleSignUp}
                disabled={isLoading}
                className="text-xs px-3 py-1.5 bg-stone-900 text-white rounded-md hover:bg-stone-800 transition-colors disabled:opacity-50"
              >
                {isLoading ? "..." : "Sign Up"}
              </button>
            )
          ) : (
            <Link
              href="/auth/login"
              className="text-xs text-parish-gold hover:text-parish-gold/80 transition-colors"
            >
              Sign in to join
            </Link>
          )}

          {/* Comments toggle */}
          <button
            onClick={() => setShowComments(!showComments)}
            className={`p-1 transition-colors ${showComments ? "text-stone-600" : "text-stone-400 hover:text-stone-600"}`}
            title={showComments ? "Hide comments" : "Show comments"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </button>

          {/* Expand roster toggle */}
          {summary.total > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 text-stone-400 hover:text-stone-600 transition-colors"
              title={expanded ? "Hide roster" : "Show roster"}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-transform ${expanded ? "rotate-180" : ""}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Voice part picker (when no default) */}
      {showPartPicker && !isSignedUp && (
        <div className="px-3 pb-2.5 flex items-center gap-1.5 ml-[76px]">
          <span className="text-xs text-stone-500 mr-1">Voice part:</span>
          {VOICE_PARTS.map((part) => (
            <button
              key={part}
              onClick={() => {
                setShowPartPicker(false);
                onSignUp(part);
              }}
              disabled={isLoading}
              className="text-xs px-2 py-1 border border-stone-300 rounded hover:bg-stone-50 text-stone-700 transition-colors disabled:opacity-50"
            >
              {part}
            </button>
          ))}
          <button
            onClick={() => setShowPartPicker(false)}
            className="text-xs text-stone-400 hover:text-stone-600 ml-1"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Expanded roster */}
      {expanded && summary.total > 0 && (
        <div className="border-t border-stone-100 px-3 py-2 ml-[76px]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {VOICE_PARTS.map((part) => {
              const members = summary.roster[part];
              if (members.length === 0) return null;
              return (
                <div key={part}>
                  <p className="text-[10px] uppercase tracking-wide text-stone-400 font-semibold mb-1">
                    {part} ({members.length})
                  </p>
                  <ul className="space-y-0.5">
                    {members.map((m) => (
                      <li
                        key={m.id}
                        className={`text-xs ${
                          m.user_id === mySignup?.user_id
                            ? "text-green-700 font-medium"
                            : "text-stone-600"
                        }`}
                      >
                        {m.profile?.full_name || "Unknown"}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* Change voice part (if signed up) */}
          {isSignedUp && (
            <div className="mt-2 pt-2 border-t border-stone-100 flex items-center gap-1.5">
              <span className="text-[10px] text-stone-400">Change to:</span>
              {VOICE_PARTS.filter((p) => p !== mySignup!.voice_part).map(
                (part) => (
                  <button
                    key={part}
                    onClick={() => onChangeVoicePart(part)}
                    disabled={isLoading}
                    className="text-[10px] px-1.5 py-0.5 border border-stone-200 rounded hover:bg-stone-50 text-stone-500 transition-colors disabled:opacity-50"
                  >
                    {part}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      )}

      {/* Comments section */}
      {showComments && (
        <div className="border-t border-stone-100 px-3 py-2 ml-[76px]">
          <MassComments massEventId={mass.id} />
        </div>
      )}
    </div>
  );
}
