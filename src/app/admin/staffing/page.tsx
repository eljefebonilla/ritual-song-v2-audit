"use client";

import { useState, useEffect, useCallback } from "react";
import type { UnderstaffedMass, ReminderCandidate, ScanResult } from "@/tools/reminder/types";

function formatDate(d: string): string {
  try {
    return new Date(d + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return d;
  }
}

export default function StaffingPage() {
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [sendingAlerts, setSendingAlerts] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);

  const fetchScan = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/staffing");
      if (res.ok) setScan(await res.json());
    } catch (err) {
      console.error("Failed to fetch staffing scan:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchScan(); }, [fetchScan]);

  const handleSendReminders = async () => {
    if (!scan?.upcomingReminders.length) return;
    setSendingReminders(true);
    try {
      const res = await fetch("/api/staffing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sendReminders", candidates: scan.upcomingReminders }),
      });
      const data = await res.json();
      setLastAction(`Sent ${data.sent} reminders (${data.skipped} skipped, ${data.errors} errors)`);
      await fetchScan();
    } finally {
      setSendingReminders(false);
    }
  };

  const handleSendAlerts = async () => {
    if (!scan?.understaffedMasses.length) return;
    setSendingAlerts(true);
    try {
      const res = await fetch("/api/staffing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sendAlerts", masses: scan.understaffedMasses }),
      });
      const data = await res.json();
      setLastAction(`Sent ${data.alertsSent} admin alerts`);
    } finally {
      setSendingAlerts(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-16">
      {/* Hero */}
      <div
        className="px-6 pt-8 pb-6"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, color-mix(in srgb, #dc2626, transparent 90%), var(--color-background))",
        }}
      >
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted font-medium mb-2">
          Admin
        </p>
        <h1 className="font-serif text-[1.75rem] font-light text-parish-charcoal mb-1">
          Staffing Monitor
        </h1>
        <p className="text-sm text-muted">
          Understaffed Masses and musician reminders for the next 14 days
        </p>
      </div>

      {loading ? (
        <div className="px-6 py-12 text-center text-sm text-muted">Scanning upcoming Masses...</div>
      ) : !scan ? (
        <div className="px-6 py-12 text-center text-sm text-red-500">Failed to load staffing data</div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className={`rounded-lg border p-3 ${scan.understaffedMasses.length > 0 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
              <p className="text-[10px] uppercase tracking-wider text-muted font-medium">Understaffed</p>
              <p className={`text-2xl font-bold ${scan.understaffedMasses.length > 0 ? "text-red-700" : "text-green-700"}`}>
                {scan.understaffedMasses.length}
              </p>
            </div>
            <div className="bg-white rounded-lg border border-stone-200 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted font-medium">Due Reminders</p>
              <p className="text-2xl font-bold text-parish-charcoal">{scan.upcomingReminders.length}</p>
            </div>
            <div className="bg-white rounded-lg border border-stone-200 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted font-medium">Scanned</p>
              <p className="text-sm font-medium text-parish-charcoal mt-1">
                {new Date(scan.scannedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </p>
            </div>
            <div className="bg-white rounded-lg border border-stone-200 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted font-medium">Actions</p>
              <div className="flex gap-1.5 mt-1">
                <button
                  onClick={handleSendReminders}
                  disabled={sendingReminders || scan.upcomingReminders.length === 0}
                  className="text-[10px] px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-40"
                >
                  {sendingReminders ? "..." : "Send Reminders"}
                </button>
                <button
                  onClick={handleSendAlerts}
                  disabled={sendingAlerts || scan.understaffedMasses.length === 0}
                  className="text-[10px] px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-40"
                >
                  {sendingAlerts ? "..." : "Alert Admins"}
                </button>
              </div>
            </div>
          </div>

          {/* Toast */}
          {lastAction && (
            <div className="px-6 mb-4">
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 text-sm text-green-800 flex items-center justify-between">
                <span>{lastAction}</span>
                <button onClick={() => setLastAction(null)} className="text-green-600 hover:text-green-800 text-xs">Dismiss</button>
              </div>
            </div>
          )}

          {/* Understaffed Masses */}
          <div className="px-6 py-4">
            <h2 className="text-sm font-semibold text-stone-800 mb-3">
              Understaffed Masses
              {scan.understaffedMasses.length === 0 && (
                <span className="ml-2 text-green-600 font-normal">All staffed!</span>
              )}
            </h2>
            {scan.understaffedMasses.length > 0 && (
              <div className="space-y-3">
                {scan.understaffedMasses.map((mass) => (
                  <div
                    key={mass.massEventId}
                    className="bg-white rounded-lg border border-red-200 p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-stone-900 text-sm">
                          {formatDate(mass.eventDate)} {mass.startTime12h}
                        </p>
                        <p className="text-xs text-stone-600">
                          {mass.liturgicalName || "Mass"}{mass.ensemble ? ` — ${mass.ensemble}` : ""}
                        </p>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                        {mass.daysUntil}d away
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {mass.missingRoles.map((role) => (
                        <span key={role.roleId} className="text-[10px] px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 font-medium">
                          Needs {role.roleName}
                        </span>
                      ))}
                      {mass.filledRoles.map((role) => (
                        <span key={role.roleId + role.profileId} className="text-[10px] px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">
                          {role.roleName}: {role.fullName || role.personName || "TBD"}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Reminders */}
          <div className="px-6 py-4">
            <h2 className="text-sm font-semibold text-stone-800 mb-3">
              Musicians Due for Reminders
              {scan.upcomingReminders.length === 0 && (
                <span className="ml-2 text-stone-400 font-normal">None today</span>
              )}
            </h2>
            {scan.upcomingReminders.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-200">
                      <th className="text-left px-2 py-2 text-[10px] font-semibold text-stone-500 uppercase">Musician</th>
                      <th className="text-left px-2 py-2 text-[10px] font-semibold text-stone-500 uppercase">Mass</th>
                      <th className="text-left px-2 py-2 text-[10px] font-semibold text-stone-500 uppercase">Role</th>
                      <th className="text-left px-2 py-2 text-[10px] font-semibold text-stone-500 uppercase">Status</th>
                      <th className="text-left px-2 py-2 text-[10px] font-semibold text-stone-500 uppercase">Channel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scan.upcomingReminders.map((c, i) => (
                      <tr key={i} className="border-b border-stone-100">
                        <td className="px-2 py-2 text-stone-900 font-medium">{c.fullName}</td>
                        <td className="px-2 py-2 text-stone-600">
                          {formatDate(c.eventDate)} {c.startTime12h} — {c.liturgicalName || "Mass"}
                        </td>
                        <td className="px-2 py-2 text-stone-600">{c.roleName}</td>
                        <td className="px-2 py-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            c.confirmation === "confirmed" ? "bg-green-50 text-green-700" :
                            c.confirmation === "expected" ? "bg-blue-50 text-blue-700" :
                            "bg-amber-50 text-amber-700"
                          }`}>
                            {c.confirmation}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-stone-400 text-xs">
                          {c.smsConsent && c.phone ? "SMS" : c.email ? "Email" : "None"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
