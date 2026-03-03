"use client";

import { useState, useMemo } from "react";

interface Profile {
  id: string;
  full_name: string;
  email: string;
  ensemble: string | null;
  role: string;
}

interface ComplianceType {
  id: string;
  name: string;
  description: string | null;
  renewal_months: number | null;
  info_url: string | null;
}

interface ComplianceRecord {
  id: string;
  user_id: string;
  compliance_type_id: string;
  completed_date: string;
  expiry_date: string | null;
  document_url: string | null;
  notes: string | null;
  verified_by: string | null;
}

interface ComplianceShellProps {
  profiles: Profile[];
  complianceTypes: ComplianceType[];
  records: ComplianceRecord[];
}

type StatusFilter = "all" | "current" | "expired" | "missing";

function getStatus(
  record: ComplianceRecord | undefined,
  compType: ComplianceType
): "current" | "expired" | "missing" {
  if (!record) return "missing";
  if (!compType.renewal_months) return "current"; // no expiry
  if (!record.expiry_date) return "current";
  return new Date(record.expiry_date) > new Date() ? "current" : "expired";
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  current: { bg: "bg-green-100", text: "text-green-800", label: "Current" },
  expired: { bg: "bg-red-100", text: "text-red-800", label: "Expired" },
  missing: { bg: "bg-stone-100", text: "text-stone-500", label: "Missing" },
};

export default function ComplianceShell({
  profiles,
  complianceTypes,
  records,
}: ComplianceShellProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Build a record lookup: user_id -> compliance_type_id -> record
  const recordMap = useMemo(() => {
    const map = new Map<string, Map<string, ComplianceRecord>>();
    for (const r of records) {
      if (!map.has(r.user_id)) map.set(r.user_id, new Map());
      const existing = map.get(r.user_id)!.get(r.compliance_type_id);
      // Keep the most recent completed_date
      if (!existing || r.completed_date > existing.completed_date) {
        map.get(r.user_id)!.set(r.compliance_type_id, r);
      }
    }
    return map;
  }, [records]);

  // Build per-member status rows
  const rows = useMemo(() => {
    return profiles
      .filter((p) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return p.full_name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
      })
      .map((p) => {
        const statuses = complianceTypes.map((ct) => {
          const record = recordMap.get(p.id)?.get(ct.id);
          const status = getStatus(record, ct);
          return { compType: ct, record, status };
        });
        return { profile: p, statuses };
      })
      .filter((row) => {
        if (statusFilter === "all") return true;
        return row.statuses.some((s) => s.status === statusFilter);
      });
  }, [profiles, complianceTypes, recordMap, search, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    let current = 0;
    let expired = 0;
    let missing = 0;
    for (const p of profiles) {
      for (const ct of complianceTypes) {
        const r = recordMap.get(p.id)?.get(ct.id);
        const s = getStatus(r, ct);
        if (s === "current") current++;
        else if (s === "expired") expired++;
        else missing++;
      }
    }
    return { current, expired, missing };
  }, [profiles, complianceTypes, recordMap]);

  return (
    <div className="p-4 pt-14 md:p-8 md:pt-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">Compliance</h1>
        <p className="text-sm text-stone-500 mt-0.5">
          Archdiocese of LA requirements for music ministry volunteers
        </p>
      </div>

      {/* Stats badges */}
      <div className="flex gap-3 mb-4">
        <button
          onClick={() => setStatusFilter(statusFilter === "current" ? "all" : "current")}
          className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
            statusFilter === "current" ? "border-green-400 bg-green-50" : "border-stone-200 hover:bg-stone-50"
          }`}
        >
          <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1.5" />
          {stats.current} Current
        </button>
        <button
          onClick={() => setStatusFilter(statusFilter === "expired" ? "all" : "expired")}
          className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
            statusFilter === "expired" ? "border-red-400 bg-red-50" : "border-stone-200 hover:bg-stone-50"
          }`}
        >
          <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1.5" />
          {stats.expired} Expired
        </button>
        <button
          onClick={() => setStatusFilter(statusFilter === "missing" ? "all" : "missing")}
          className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
            statusFilter === "missing" ? "border-stone-400 bg-stone-100" : "border-stone-200 hover:bg-stone-50"
          }`}
        >
          <span className="inline-block w-2 h-2 rounded-full bg-stone-400 mr-1.5" />
          {stats.missing} Missing
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search members..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-sm border border-stone-200 rounded-md px-3 py-1.5 w-64 focus:outline-none focus:ring-1 focus:ring-stone-400"
        />
        <span className="text-xs text-stone-400 ml-auto">{rows.length} members</span>
      </div>

      {/* Table */}
      <div className="border border-stone-200 rounded-lg overflow-hidden bg-white overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50">
              <th className="text-left text-[10px] uppercase tracking-wider font-semibold text-stone-500 px-4 py-2.5 sticky left-0 bg-stone-50">
                Member
              </th>
              {complianceTypes.map((ct) => (
                <th key={ct.id} className="text-center text-[10px] uppercase tracking-wider font-semibold text-stone-500 px-4 py-2.5 min-w-[140px]">
                  <div>{ct.name}</div>
                  {ct.renewal_months && (
                    <div className="text-[9px] font-normal text-stone-400 mt-0.5">
                      Renews every {ct.renewal_months} mo.
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.map(({ profile, statuses }) => (
              <tr key={profile.id} className="hover:bg-stone-50">
                <td className="px-4 py-3 sticky left-0 bg-white">
                  <p className="text-sm font-medium text-stone-900">{profile.full_name}</p>
                  <p className="text-[10px] text-stone-400">{profile.ensemble || "No ensemble"}</p>
                </td>
                {statuses.map(({ compType, record, status }) => {
                  const style = STATUS_STYLES[status];
                  return (
                    <td key={compType.id} className="px-4 py-3 text-center">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${style.bg} ${style.text}`}>
                        {style.label}
                      </span>
                      {record && (
                        <p className="text-[10px] text-stone-400 mt-1">
                          {new Date(record.completed_date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                      )}
                      {status === "expired" && record?.expiry_date && (
                        <p className="text-[10px] text-red-500 mt-0.5">
                          Expired {new Date(record.expiry_date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                      )}
                      {status === "missing" && compType.info_url && (
                        <a
                          href={compType.info_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-blue-500 hover:underline mt-1 inline-block"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Sign up
                        </a>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={1 + complianceTypes.length} className="px-4 py-8 text-center text-sm text-stone-400">
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
