"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getEnsembleColor } from "@/lib/calendar-utils";
import { useUser } from "@/lib/user-context";

// ─── Constants ──────────────────────────────────────────────────────────────

const MUSICIAN_ROLE_LABELS: Record<string, string> = {
  vocalist: "Vocalist",
  instrumentalist: "Instrumentalist",
  cantor: "Cantor",
  both: "Vocalist + Inst.",
};

const ENSEMBLES = [
  "Reflections",
  "Foundations",
  "Contemporary",
  "Traditional",
  "Youth",
];

// ─── Types ───────────────────────────────────────────────────────────────────

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
  status: string;
  sms_consent: boolean | null;
}

interface MembersShellProps {
  profiles: Profile[];
  pendingCount: number;
}

// ─── Toast ───────────────────────────────────────────────────────────────────

interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

let toastId = 0;

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: "success" | "error" = "success") => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  return { toasts, addToast };
}

// ─── Invite Modal ─────────────────────────────────────────────────────────────

interface InviteModalProps {
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

function InviteModal({ onClose, onSuccess, onError }: InviteModalProps) {
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [ensemble, setEnsemble] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    if (!phone.trim() && !email.trim()) {
      onError("Enter a phone number or email address.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          ensemble: ensemble || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onSuccess(`Invitation sent! Code: ${data.code}`);
        onClose();
      } else {
        onError(data.error || "Failed to send invitation.");
      }
    } catch {
      onError("Network error. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <h2 className="text-base font-semibold text-stone-900">Invite Member</h2>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 transition-colors"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              Phone Number <span className="text-stone-400 font-normal">(for SMS)</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 310 555 0100"
              className="w-full text-sm border border-stone-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-stone-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              Email Address <span className="text-stone-400 font-normal">(for email invite)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="musician@example.com"
              className="w-full text-sm border border-stone-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-stone-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              Ensemble <span className="text-stone-400 font-normal">(optional)</span>
            </label>
            <select
              value={ensemble}
              onChange={(e) => setEnsemble(e.target.value)}
              className="w-full text-sm border border-stone-200 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-stone-400"
            >
              <option value="">Not specified</option>
              {ENSEMBLES.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-stone-100">
          <button
            onClick={onClose}
            className="text-sm px-4 py-1.5 rounded-md text-stone-600 hover:text-stone-800 hover:bg-stone-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={sending}
            className="text-sm px-4 py-1.5 rounded-md bg-stone-900 text-white hover:bg-stone-700 transition-colors disabled:opacity-50"
          >
            {sending ? "Sending..." : "Send Invite"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Pending Member Card ──────────────────────────────────────────────────────

interface PendingCardProps {
  profile: Profile;
  selected: boolean;
  onToggleSelect: () => void;
  onApprove: () => void;
  onDecline: () => void;
  disabled: boolean;
}

function PendingCard({ profile, selected, onToggleSelect, onApprove, onDecline, disabled }: PendingCardProps) {
  const ensembleStyle = profile.ensemble ? getEnsembleColor(profile.ensemble) : null;
  const musicianLabel = MUSICIAN_ROLE_LABELS[profile.musician_role || "vocalist"] || profile.musician_role;
  const signedUp = new Date(profile.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg bg-white border transition-colors ${selected ? "border-amber-400 ring-1 ring-amber-300" : "border-stone-200"}`}>
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggleSelect}
        className="mt-1 rounded border-stone-300 text-amber-500 focus:ring-amber-400"
        onClick={(e) => e.stopPropagation()}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-7 h-7 rounded-full bg-stone-200 flex items-center justify-center text-xs font-medium text-stone-600 shrink-0">
            {profile.full_name.charAt(0)}
          </div>
          <p className="text-sm font-medium text-stone-900">{profile.full_name}</p>
          {profile.ensemble && ensembleStyle && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={ensembleStyle}>
              {profile.ensemble}
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-3 flex-wrap">
          <span className="text-xs text-stone-500">{musicianLabel}</span>
          {profile.voice_part && (
            <span className="text-xs text-stone-400">{profile.voice_part}</span>
          )}
          {(profile.instrument_detail || profile.instrument) && (
            <span className="text-xs text-stone-400">{profile.instrument_detail || profile.instrument}</span>
          )}
          <span className="text-xs text-stone-400 ml-auto">Signed up {signedUp}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="text-xs text-stone-400">{profile.email}</span>
          {profile.phone && <span className="text-xs text-stone-400">{profile.phone}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onApprove}
          disabled={disabled}
          className="text-xs px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-40 font-medium"
        >
          Approve
        </button>
        <button
          onClick={onDecline}
          disabled={disabled}
          className="text-xs px-2 py-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
        >
          Decline
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MembersShell({ profiles: initialProfiles, pendingCount: initialPendingCount }: MembersShellProps) {
  const router = useRouter();
  const { user } = useUser();
  const { toasts, addToast } = useToast();

  // Optimistic profile state
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles);

  // Filters (active members list)
  const [search, setSearch] = useState("");
  const [ensembleFilter, setEnsembleFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Pending section
  const [selectedPending, setSelectedPending] = useState<Set<string>>(new Set());
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Inactive section
  const [showInactive, setShowInactive] = useState(false);

  // Invite modal
  const [showInvite, setShowInvite] = useState(false);

  // Derived lists
  const pendingProfiles = useMemo(
    () => profiles.filter((p) => p.status === "pending"),
    [profiles]
  );
  const activeProfiles = useMemo(
    () => profiles.filter((p) => p.status === "active"),
    [profiles]
  );
  const inactiveProfiles = useMemo(
    () => profiles.filter((p) => p.status === "inactive"),
    [profiles]
  );

  const ensembles = useMemo(() => {
    const set = new Set(profiles.map((p) => p.ensemble).filter(Boolean));
    return Array.from(set).sort();
  }, [profiles]);

  const stats = useMemo(() => {
    const admins = activeProfiles.filter((p) => p.role === "admin").length;
    const vocalists = activeProfiles.filter(
      (p) => p.musician_role === "vocalist" || p.musician_role === "cantor" || p.musician_role === "both"
    ).length;
    const instrumentalists = activeProfiles.filter(
      (p) => p.musician_role === "instrumentalist" || p.musician_role === "both"
    ).length;
    return { total: activeProfiles.length, admins, vocalists, instrumentalists };
  }, [activeProfiles]);

  const filteredActive = useMemo(() => {
    return activeProfiles.filter((p) => {
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
  }, [activeProfiles, search, ensembleFilter, roleFilter]);

  // ── Optimistic helpers ──────────────────────────────────────────────────────

  const setProfileStatus = useCallback((id: string, status: string) => {
    setProfiles((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status } : p))
    );
  }, []);

  const setProfileRole = useCallback((id: string, role: string) => {
    setProfiles((prev) =>
      prev.map((p) => (p.id === id ? { ...p, role } : p))
    );
  }, []);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const approveOne = useCallback(
    async (id: string) => {
      setProcessingId(id);
      // Optimistic update
      setProfileStatus(id, "active");
      setSelectedPending((prev) => { const next = new Set(prev); next.delete(id); return next; });
      try {
        const res = await fetch(`/api/admin/members/${id}/approve`, { method: "PUT" });
        if (!res.ok) {
          // Rollback
          setProfileStatus(id, "pending");
          addToast("Failed to approve member.", "error");
        } else {
          addToast("Member approved.");
        }
      } catch {
        setProfileStatus(id, "pending");
        addToast("Network error.", "error");
      } finally {
        setProcessingId(null);
      }
    },
    [setProfileStatus, addToast]
  );

  const declineOne = useCallback(
    async (id: string) => {
      setProcessingId(id);
      setProfileStatus(id, "inactive");
      setSelectedPending((prev) => { const next = new Set(prev); next.delete(id); return next; });
      try {
        const res = await fetch(`/api/admin/members/${id}/reject`, { method: "PUT" });
        if (!res.ok) {
          setProfileStatus(id, "pending");
          addToast("Failed to decline member.", "error");
        } else {
          addToast("Member declined.");
        }
      } catch {
        setProfileStatus(id, "pending");
        addToast("Network error.", "error");
      } finally {
        setProcessingId(null);
      }
    },
    [setProfileStatus, addToast]
  );

  const approveSelected = useCallback(async () => {
    if (selectedPending.size === 0) return;
    setBulkProcessing(true);
    const ids = Array.from(selectedPending);
    // Optimistic
    ids.forEach((id) => setProfileStatus(id, "active"));
    setSelectedPending(new Set());
    try {
      const results = await Promise.allSettled(
        ids.map((id) =>
          fetch(`/api/admin/members/${id}/approve`, { method: "PUT" })
        )
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) {
        addToast(`${ids.length - failed} approved, ${failed} failed.`, "error");
        router.refresh();
      } else {
        addToast(`${ids.length} member${ids.length !== 1 ? "s" : ""} approved.`);
      }
    } catch {
      addToast("Bulk approve failed.", "error");
      router.refresh();
    } finally {
      setBulkProcessing(false);
    }
  }, [selectedPending, setProfileStatus, addToast, router]);

  const deactivateOne = useCallback(
    async (id: string) => {
      setProcessingId(id);
      setProfileStatus(id, "inactive");
      try {
        const res = await fetch(`/api/admin/members/${id}/deactivate`, { method: "PUT" });
        if (!res.ok) {
          setProfileStatus(id, "active");
          addToast("Failed to deactivate member.", "error");
        } else {
          addToast("Member deactivated.");
        }
      } catch {
        setProfileStatus(id, "active");
        addToast("Network error.", "error");
      } finally {
        setProcessingId(null);
      }
    },
    [setProfileStatus, addToast]
  );

  const reactivateOne = useCallback(
    async (id: string) => {
      setProcessingId(id);
      setProfileStatus(id, "active");
      try {
        const res = await fetch(`/api/admin/members/${id}/reactivate`, { method: "PUT" });
        if (!res.ok) {
          setProfileStatus(id, "inactive");
          addToast("Failed to reactivate member.", "error");
        } else {
          addToast("Member reactivated.");
        }
      } catch {
        setProfileStatus(id, "inactive");
        addToast("Network error.", "error");
      } finally {
        setProcessingId(null);
      }
    },
    [setProfileStatus, addToast]
  );

  const toggleRole = useCallback(
    async (profileId: string, currentRole: string) => {
      if (profileId === user?.id) return;
      const newRole = currentRole === "admin" ? "member" : "admin";
      setTogglingId(profileId);
      setProfileRole(profileId, newRole);
      try {
        const res = await fetch("/api/admin/members", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: profileId, role: newRole }),
        });
        if (!res.ok) {
          setProfileRole(profileId, currentRole);
          addToast("Failed to update role.", "error");
        }
      } catch {
        setProfileRole(profileId, currentRole);
        addToast("Network error.", "error");
      } finally {
        setTogglingId(null);
      }
    },
    [user?.id, setProfileRole, addToast]
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  const allPendingSelected =
    pendingProfiles.length > 0 &&
    pendingProfiles.every((p) => selectedPending.has(p.id));

  return (
    <div className="p-4 pt-14 md:p-8 md:pt-8 max-w-6xl">
      {/* Toast container */}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium transition-all pointer-events-auto ${
              t.type === "success"
                ? "bg-stone-900 text-white"
                : "bg-red-600 text-white"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Members</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            {stats.total} active &middot; {stats.admins} admin{stats.admins !== 1 ? "s" : ""} &middot; {stats.vocalists} vocalist{stats.vocalists !== 1 ? "s" : ""} &middot; {stats.instrumentalists} instrumentalist{stats.instrumentalists !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-stone-900 text-white hover:bg-stone-700 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Invite Member
        </button>
      </div>

      {/* ── Pending Approval Section ─────────────────────────────────────── */}
      {pendingProfiles.length > 0 && (
        <div className="mb-8 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-amber-900">Pending Approval</h2>
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-amber-500 text-white">
                {pendingProfiles.length}
              </span>
            </div>
            {selectedPending.size > 0 && (
              <button
                onClick={approveSelected}
                disabled={bulkProcessing}
                className="text-xs px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 font-medium"
              >
                {bulkProcessing ? "Approving..." : `Approve Selected (${selectedPending.size})`}
              </button>
            )}
            {pendingProfiles.length > 1 && selectedPending.size === 0 && (
              <button
                onClick={() => setSelectedPending(new Set(pendingProfiles.map((p) => p.id)))}
                className="text-xs text-amber-700 hover:text-amber-900 transition-colors"
              >
                Select all
              </button>
            )}
            {allPendingSelected && (
              <button
                onClick={() => setSelectedPending(new Set())}
                className="text-xs text-amber-700 hover:text-amber-900 transition-colors"
              >
                Deselect all
              </button>
            )}
          </div>
          <div className="space-y-2">
            {pendingProfiles.map((p) => (
              <PendingCard
                key={p.id}
                profile={p}
                selected={selectedPending.has(p.id)}
                onToggleSelect={() =>
                  setSelectedPending((prev) => {
                    const next = new Set(prev);
                    if (next.has(p.id)) next.delete(p.id);
                    else next.add(p.id);
                    return next;
                  })
                }
                onApprove={() => approveOne(p.id)}
                onDecline={() => declineOne(p.id)}
                disabled={processingId === p.id || bulkProcessing}
              />
            ))}
          </div>
        </div>
      )}

      {pendingProfiles.length === 0 && (
        <div className="mb-6 text-xs text-stone-400 bg-stone-50 border border-stone-100 rounded-lg px-4 py-3">
          No pending members. Everyone&apos;s been reviewed.
        </div>
      )}

      {/* ── Active Members Section ───────────────────────────────────────── */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-stone-700 mb-3">Active Members</h2>

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
            {filteredActive.length} of {activeProfiles.length}
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
                <th className="text-left text-[10px] uppercase tracking-wider font-semibold text-stone-500 px-4 py-2.5 hidden lg:table-cell">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredActive.map((p) => {
                const ensembleStyle = p.ensemble ? getEnsembleColor(p.ensemble) : null;
                const isExpanded = expandedId === p.id;
                const isSelf = p.id === user?.id;
                const isToggling = togglingId === p.id;
                const isProcessing = processingId === p.id;
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
                              {!isSelf && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); deactivateOne(p.id); }}
                                  disabled={isProcessing}
                                  className="text-[10px] px-2 py-0.5 rounded border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                                >
                                  Deactivate
                                </button>
                              )}
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
                            onClick={(e) => { e.stopPropagation(); toggleRole(p.id, p.role); }}
                            disabled={isToggling}
                            className="text-[10px] px-1.5 py-0.5 rounded border border-stone-200 text-stone-500 hover:bg-stone-100 hover:text-stone-700 transition-colors disabled:opacity-40"
                            title={p.role === "admin" ? "Demote to member" : "Promote to admin"}
                          >
                            {isToggling ? "..." : p.role === "admin" ? "Demote" : "Promote"}
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
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {!isSelf && (
                        <button
                          onClick={(e) => { e.stopPropagation(); deactivateOne(p.id); }}
                          disabled={isProcessing}
                          className="text-[10px] px-2 py-0.5 rounded border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                        >
                          {isProcessing ? "..." : "Deactivate"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredActive.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-stone-400">
                    No active members match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Inactive Section ─────────────────────────────────────────────── */}
      {inactiveProfiles.length > 0 && (
        <div>
          <button
            onClick={() => setShowInactive((v) => !v)}
            className="flex items-center gap-2 text-sm font-medium text-stone-500 hover:text-stone-700 transition-colors mb-3"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform ${showInactive ? "rotate-90" : ""}`}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            Inactive / Declined ({inactiveProfiles.length})
          </button>

          {showInactive && (
            <div className="border border-stone-200 rounded-lg overflow-hidden bg-white">
              <table className="w-full">
                <tbody className="divide-y divide-stone-100">
                  {inactiveProfiles.map((p) => {
                    const ensembleStyle = p.ensemble ? getEnsembleColor(p.ensemble) : null;
                    const isProcessing = processingId === p.id;
                    return (
                      <tr key={p.id} className="hover:bg-stone-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center text-xs font-medium text-stone-400 shrink-0">
                              {p.full_name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm text-stone-500">{p.full_name}</p>
                              <p className="text-xs text-stone-400">{p.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          {p.ensemble && ensembleStyle ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium opacity-60" style={ensembleStyle}>
                              {p.ensemble}
                            </span>
                          ) : (
                            <span className="text-xs text-stone-300">&mdash;</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => reactivateOne(p.id)}
                            disabled={isProcessing}
                            className="text-xs px-3 py-1 rounded-md bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors disabled:opacity-40"
                          >
                            {isProcessing ? "..." : "Reactivate"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Invite Modal */}
      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onSuccess={(msg) => addToast(msg, "success")}
          onError={(msg) => addToast(msg, "error")}
        />
      )}
    </div>
  );
}
