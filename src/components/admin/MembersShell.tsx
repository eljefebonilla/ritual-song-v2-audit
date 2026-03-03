"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getEnsembleColor } from "@/lib/calendar-utils";
import { useUser } from "@/lib/user-context";

const MUSICIAN_ROLE_LABELS: Record<string, string> = {
  vocalist: "Vocalist",
  instrumentalist: "Instrumentalist",
  cantor: "Cantor",
  both: "Vocalist + Inst.",
};

interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  ensemble: string | null;
  voice_part: string | null;
  instrument: string | null;
  instrument_detail: string | null;
  musician_role: string | null;
  role: string;
  avatar_url: string | null;
  created_at: string;
}

interface MembersShellProps {
  profiles: Profile[];
}

export default function MembersShell({ profiles }: MembersShellProps) {
  const router = useRouter();
  const { user } = useUser();
  const [search, setSearch] = useState("");
  const [ensembleFilter, setEnsembleFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return profiles.filter((p) => {
      if (ensembleFilter !== "all" && p.ensemble !== ensembleFilter) return false;
      if (roleFilter !== "all" && p.role !== roleFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          p.full_name.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q) ||
          (p.instrument && p.instrument.toLowerCase().includes(q)) ||
          (p.instrument_detail && p.instrument_detail.toLowerCase().includes(q)) ||
          (p.voice_part && p.voice_part.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [profiles, search, ensembleFilter, roleFilter]);

  const ensembles = useMemo(() => {
    const set = new Set(profiles.map((p) => p.ensemble).filter(Boolean));
    return Array.from(set).sort();
  }, [profiles]);

  const stats = useMemo(() => {
    const admins = profiles.filter((p) => p.role === "admin").length;
    const vocalists = profiles.filter((p) =>
      p.musician_role === "vocalist" || p.musician_role === "cantor" || p.musician_role === "both"
    ).length;
    const instrumentalists = profiles.filter((p) =>
      p.musician_role === "instrumentalist" || p.musician_role === "both"
    ).length;
    return { total: profiles.length, admins, vocalists, instrumentalists };
  }, [profiles]);

  const toggleRole = useCallback(async (profileId: string, currentRole: string) => {
    // Prevent self-demotion
    if (profileId === user?.id) return;

    const newRole = currentRole === "admin" ? "member" : "admin";
    setTogglingId(profileId);

    try {
      const res = await fetch("/api/admin/members", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: profileId, role: newRole }),
      });

      if (res.ok) {
        router.refresh();
      }
    } finally {
      setTogglingId(null);
    }
  }, [user?.id, router]);

  return (
    <div className="p-4 pt-14 md:p-8 md:pt-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Members</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            {stats.total} members &middot; {stats.admins} admin{stats.admins !== 1 ? "s" : ""} &middot; {stats.vocalists} vocalist{stats.vocalists !== 1 ? "s" : ""} &middot; {stats.instrumentalists} instrumentalist{stats.instrumentalists !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="Search name, email, instrument..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-sm border border-stone-200 rounded-md px-3 py-1.5 w-64 focus:outline-none focus:ring-1 focus:ring-stone-400"
        />
        <select
          value={ensembleFilter}
          onChange={(e) => setEnsembleFilter(e.target.value)}
          className="text-sm border border-stone-200 rounded-md px-2 py-1.5 bg-white"
        >
          <option value="all">All Ensembles</option>
          {ensembles.map((c) => (
            <option key={c} value={c!}>{c}</option>
          ))}
        </select>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="text-sm border border-stone-200 rounded-md px-2 py-1.5 bg-white"
        >
          <option value="all">All Roles</option>
          <option value="admin">Admin</option>
          <option value="member">Member</option>
        </select>
        <span className="text-xs text-stone-400 ml-auto">
          {filtered.length} of {profiles.length}
        </span>
      </div>

      {/* Table */}
      <div className="border border-stone-200 rounded-lg overflow-hidden bg-white">
        <table className="w-full">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50">
              <th className="text-left text-[10px] uppercase tracking-wider font-semibold text-stone-500 px-4 py-2.5">Name</th>
              <th className="text-left text-[10px] uppercase tracking-wider font-semibold text-stone-500 px-4 py-2.5 hidden md:table-cell">Ensemble</th>
              <th className="text-left text-[10px] uppercase tracking-wider font-semibold text-stone-500 px-4 py-2.5 hidden md:table-cell">Musician Role</th>
              <th className="text-left text-[10px] uppercase tracking-wider font-semibold text-stone-500 px-4 py-2.5 hidden lg:table-cell">Voice / Instrument</th>
              <th className="text-left text-[10px] uppercase tracking-wider font-semibold text-stone-500 px-4 py-2.5">Role</th>
              <th className="text-left text-[10px] uppercase tracking-wider font-semibold text-stone-500 px-4 py-2.5 hidden lg:table-cell">Contact</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {filtered.map((p) => {
              const ensembleStyle = p.ensemble ? getEnsembleColor(p.ensemble) : null;
              const isExpanded = expandedId === p.id;
              const isSelf = p.id === user?.id;
              const isToggling = togglingId === p.id;
              const musicianRoleLabel = MUSICIAN_ROLE_LABELS[p.musician_role || "vocalist"] || p.musician_role;
              const voiceInstrumentParts: string[] = [];
              if (p.voice_part) voiceInstrumentParts.push(p.voice_part);
              if (p.instrument_detail || p.instrument) voiceInstrumentParts.push(p.instrument_detail || p.instrument || "");

              return (
                <tr
                  key={p.id}
                  onClick={() => setExpandedId(isExpanded ? null : p.id)}
                  className="hover:bg-stone-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center text-xs font-medium text-stone-600 shrink-0">
                        {p.full_name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-stone-900 truncate">{p.full_name}</p>
                        {isExpanded && (
                          <div className="mt-1 space-y-0.5 md:hidden">
                            {p.ensemble && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium inline-block" style={ensembleStyle!}>{p.ensemble}</span>
                            )}
                            <p className="text-xs text-stone-500">{musicianRoleLabel}</p>
                            {voiceInstrumentParts.length > 0 && (
                              <p className="text-xs text-stone-500">{voiceInstrumentParts.join(" / ")}</p>
                            )}
                            {p.email && <p className="text-xs text-stone-400">{p.email}</p>}
                            {p.phone && <p className="text-xs text-stone-400">{p.phone}</p>}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {p.ensemble ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={ensembleStyle!}>
                        {p.ensemble}
                      </span>
                    ) : (
                      <span className="text-xs text-stone-300">&mdash;</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs text-stone-600">{musicianRoleLabel}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs text-stone-600">
                      {voiceInstrumentParts.length > 0
                        ? voiceInstrumentParts.join(" / ")
                        : <span className="text-stone-300">&mdash;</span>
                      }
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        p.role === "admin"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-stone-100 text-stone-600"
                      }`}>
                        {p.role}
                      </span>
                      {!isSelf && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRole(p.id, p.role);
                          }}
                          disabled={isToggling}
                          className="text-[10px] px-1.5 py-0.5 rounded border border-stone-200 text-stone-500 hover:bg-stone-100 hover:text-stone-700 transition-colors disabled:opacity-40"
                          title={p.role === "admin" ? "Demote to member" : "Promote to admin"}
                        >
                          {isToggling
                            ? "..."
                            : p.role === "admin"
                            ? "Demote"
                            : "Promote"}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="space-y-0.5">
                      <p className="text-xs text-stone-500 truncate max-w-[200px]">{p.email}</p>
                      {p.phone && <p className="text-xs text-stone-400">{p.phone}</p>}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-stone-400">
                  No members match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
