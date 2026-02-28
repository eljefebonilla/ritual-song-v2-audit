"use client";

import { useState, useMemo } from "react";
import { getCommunityColor } from "@/lib/calendar-utils";

interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  community: string | null;
  voice_part: string | null;
  instrument: string | null;
  role: string;
  avatar_url: string | null;
  created_at: string;
}

interface MembersShellProps {
  profiles: Profile[];
}

export default function MembersShell({ profiles }: MembersShellProps) {
  const [search, setSearch] = useState("");
  const [communityFilter, setCommunityFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return profiles.filter((p) => {
      if (communityFilter !== "all" && p.community !== communityFilter) return false;
      if (roleFilter !== "all" && p.role !== roleFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          p.full_name.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q) ||
          (p.instrument && p.instrument.toLowerCase().includes(q)) ||
          (p.voice_part && p.voice_part.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [profiles, search, communityFilter, roleFilter]);

  const communities = useMemo(() => {
    const set = new Set(profiles.map((p) => p.community).filter(Boolean));
    return Array.from(set).sort();
  }, [profiles]);

  const stats = useMemo(() => {
    const admins = profiles.filter((p) => p.role === "admin").length;
    const vocalists = profiles.filter((p) => p.voice_part).length;
    const instrumentalists = profiles.filter((p) => p.instrument).length;
    return { total: profiles.length, admins, vocalists, instrumentalists };
  }, [profiles]);

  return (
    <div className="p-4 pt-14 md:p-8 md:pt-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Members</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            {stats.total} members &middot; {stats.admins} admin{stats.admins !== 1 ? "s" : ""} &middot; {stats.vocalists} vocalists &middot; {stats.instrumentalists} instrumentalists
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
          value={communityFilter}
          onChange={(e) => setCommunityFilter(e.target.value)}
          className="text-sm border border-stone-200 rounded-md px-2 py-1.5 bg-white"
        >
          <option value="all">All Communities</option>
          {communities.map((c) => (
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
              <th className="text-left text-[10px] uppercase tracking-wider font-semibold text-stone-500 px-4 py-2.5 hidden md:table-cell">Community</th>
              <th className="text-left text-[10px] uppercase tracking-wider font-semibold text-stone-500 px-4 py-2.5 hidden md:table-cell">Voice</th>
              <th className="text-left text-[10px] uppercase tracking-wider font-semibold text-stone-500 px-4 py-2.5 hidden lg:table-cell">Instrument</th>
              <th className="text-left text-[10px] uppercase tracking-wider font-semibold text-stone-500 px-4 py-2.5">Role</th>
              <th className="text-left text-[10px] uppercase tracking-wider font-semibold text-stone-500 px-4 py-2.5 hidden lg:table-cell">Contact</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {filtered.map((p) => {
              const communityStyle = p.community ? getCommunityColor(p.community) : null;
              const isExpanded = expandedId === p.id;

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
                            {p.community && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium inline-block" style={communityStyle!}>{p.community}</span>
                            )}
                            {p.voice_part && <p className="text-xs text-stone-500">{p.voice_part}</p>}
                            {p.instrument && <p className="text-xs text-stone-500">{p.instrument}</p>}
                            {p.email && <p className="text-xs text-stone-400">{p.email}</p>}
                            {p.phone && <p className="text-xs text-stone-400">{p.phone}</p>}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {p.community ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={communityStyle!}>
                        {p.community}
                      </span>
                    ) : (
                      <span className="text-xs text-stone-300">&mdash;</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs text-stone-600">{p.voice_part || <span className="text-stone-300">&mdash;</span>}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs text-stone-600">{p.instrument || <span className="text-stone-300">&mdash;</span>}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      p.role === "admin"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-stone-100 text-stone-600"
                    }`}>
                      {p.role}
                    </span>
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
