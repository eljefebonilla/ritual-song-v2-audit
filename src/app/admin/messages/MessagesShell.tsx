"use client";

import { useState, useMemo, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Profile {
  id: string;
  full_name: string;
  ensemble: string | null;
  email: string;
  phone: string | null;
  sms_consent: boolean | null;
}

interface NotificationLog {
  id: string;
  channel: "sms" | "email";
  message_type: string;
  status: string;
  created_at: string;
  recipient_id: string | null;
}

interface MessagesShellProps {
  profiles: Profile[];
  ensembles: string[];
  initialLogs: NotificationLog[];
}

type RecipientType = "all" | "ensemble" | "custom";
type Channel = "sms" | "email" | "both";

// ─── Toast ────────────────────────────────────────────────────────────────────

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
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);
  return { toasts, addToast };
}

// ─── SMS_LIMIT ────────────────────────────────────────────────────────────────

const SMS_LIMIT = 160;

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  recipientCount: number;
  channel: Channel;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({ recipientCount, channel, onConfirm, onCancel }: ConfirmDialogProps) {
  const channelLabel = channel === "both" ? "SMS + email" : channel;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-base font-semibold text-stone-900 mb-2">Confirm Send</h2>
        <p className="text-sm text-stone-600 mb-4">
          Send {channelLabel} to{" "}
          <span className="font-semibold text-stone-900">{recipientCount} recipient{recipientCount !== 1 ? "s" : ""}</span>?
          {channel !== "email" && (
            <span className="block mt-1 text-xs text-stone-400">
              Only members with SMS consent will receive texts.
            </span>
          )}
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="text-sm px-4 py-1.5 rounded-md text-stone-600 hover:bg-stone-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="text-sm px-4 py-1.5 rounded-md bg-stone-900 text-white hover:bg-stone-700 transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Log Row ──────────────────────────────────────────────────────────────────

function LogRow({ log }: { log: NotificationLog }) {
  const date = new Date(log.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const channelIcon =
    log.channel === "sms" ? (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ) : (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    );

  return (
    <tr className="hover:bg-stone-50 transition-colors">
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-1.5 text-stone-500">
          {channelIcon}
          <span className="text-xs capitalize">{log.channel}</span>
        </div>
      </td>
      <td className="px-4 py-2.5">
        <span className="text-xs text-stone-600 capitalize">{log.message_type}</span>
      </td>
      <td className="px-4 py-2.5">
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
          log.status === "sent"
            ? "bg-emerald-100 text-emerald-800"
            : "bg-red-100 text-red-700"
        }`}>
          {log.status}
        </span>
      </td>
      <td className="px-4 py-2.5">
        <span className="text-xs text-stone-400">{date}</span>
      </td>
    </tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MessagesShell({ profiles, ensembles, initialLogs }: MessagesShellProps) {
  const { toasts, addToast } = useToast();

  // Form state
  const [recipientType, setRecipientType] = useState<RecipientType>("all");
  const [selectedEnsemble, setSelectedEnsemble] = useState<string>("");
  const [selectedCustomIds, setSelectedCustomIds] = useState<Set<string>>(new Set());
  const [channel, setChannel] = useState<Channel>("both");
  const [smsBody, setSmsBody] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  // UI state
  const [showConfirm, setShowConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [logs, setLogs] = useState(initialLogs);

  // Resolve recipient count for preview
  const recipientCount = useMemo(() => {
    if (recipientType === "all") return profiles.length;
    if (recipientType === "ensemble") {
      return profiles.filter((p) => p.ensemble === selectedEnsemble).length;
    }
    return selectedCustomIds.size;
  }, [recipientType, selectedEnsemble, selectedCustomIds, profiles]);

  const smsChars = smsBody.length;
  const smsOver = smsChars > SMS_LIMIT;

  const isValid = useMemo(() => {
    if (recipientCount === 0) return false;
    if (recipientType === "ensemble" && !selectedEnsemble) return false;
    if (recipientType === "custom" && selectedCustomIds.size === 0) return false;
    if (channel === "sms" || channel === "both") {
      if (!smsBody.trim() || smsOver) return false;
    }
    if (channel === "email" || channel === "both") {
      if (!emailSubject.trim() || !emailBody.trim()) return false;
    }
    return true;
  }, [recipientCount, recipientType, selectedEnsemble, selectedCustomIds, channel, smsBody, emailSubject, emailBody, smsOver]);

  const handleSend = useCallback(async () => {
    setShowConfirm(false);
    setSending(true);
    try {
      const body = {
        recipientType,
        ensemble: recipientType === "ensemble" ? selectedEnsemble : undefined,
        profileIds: recipientType === "custom" ? Array.from(selectedCustomIds) : undefined,
        channel,
        smsBody: channel !== "email" ? smsBody : undefined,
        emailSubject: channel !== "sms" ? emailSubject : undefined,
        emailBody: channel !== "sms" ? emailBody : undefined,
      };

      const res = await fetch("/api/admin/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (res.ok) {
        const parts: string[] = [];
        if (data.smsSent > 0) parts.push(`${data.smsSent} SMS`);
        if (data.emailSent > 0) parts.push(`${data.emailSent} emails`);
        const skipParts: string[] = [];
        if (data.noConsent > 0) skipParts.push(`${data.noConsent} no SMS consent`);
        if (data.noPhone > 0) skipParts.push(`${data.noPhone} no phone number`);
        if (data.skipped > 0 && skipParts.length === 0) skipParts.push(`${data.skipped} skipped`);
        addToast(`Sent: ${parts.join(", ") || "0 messages"}.${skipParts.length > 0 ? ` Skipped: ${skipParts.join(", ")}.` : ""}`);

        // Reset form
        setSmsBody("");
        setEmailSubject("");
        setEmailBody("");
        setSelectedCustomIds(new Set());

        // Refresh logs
        const logRes = await fetch("/api/admin/messages");
        const logData = await logRes.json();
        if (logData.logs) setLogs(logData.logs);
      } else {
        addToast(data.error || "Send failed.", "error");
      }
    } catch {
      addToast("Network error. Try again.", "error");
    } finally {
      setSending(false);
    }
  }, [recipientType, selectedEnsemble, selectedCustomIds, channel, smsBody, emailSubject, emailBody, addToast]);

  const toggleCustomId = useCallback((id: string) => {
    setSelectedCustomIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div className="p-4 pt-14 md:p-8 md:pt-8 max-w-4xl">
      {/* Toast container */}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium pointer-events-auto ${
              t.type === "success" ? "bg-stone-900 text-white" : "bg-red-600 text-white"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">Send Message</h1>
        <p className="text-sm text-stone-500 mt-0.5">
          Send SMS and/or email to ministry members.
        </p>
      </div>

      <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-6">

        {/* Recipients */}
        <div>
          <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
            Recipients
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {(["all", "ensemble", "custom"] as const).map((rt) => (
              <button
                key={rt}
                onClick={() => setRecipientType(rt)}
                className={`text-sm px-3 py-1.5 rounded-md border transition-colors ${
                  recipientType === rt
                    ? "bg-stone-900 text-white border-stone-900"
                    : "border-stone-200 text-stone-600 hover:border-stone-400"
                }`}
              >
                {rt === "all" ? `All Active Members (${profiles.length})` : rt === "ensemble" ? "By Ensemble" : "Custom"}
              </button>
            ))}
          </div>

          {recipientType === "ensemble" && (
            <select
              value={selectedEnsemble}
              onChange={(e) => setSelectedEnsemble(e.target.value)}
              className="text-sm border border-stone-200 rounded-md px-3 py-1.5 bg-white w-full max-w-xs focus:outline-none focus:ring-1 focus:ring-stone-400"
            >
              <option value="">Select ensemble...</option>
              {ensembles.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          )}

          {recipientType === "custom" && (
            <div className="mt-2 border border-stone-200 rounded-lg max-h-48 overflow-y-auto">
              {profiles.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-stone-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedCustomIds.has(p.id)}
                    onChange={() => toggleCustomId(p.id)}
                    className="rounded border-stone-300 text-stone-700 focus:ring-stone-400"
                  />
                  <span className="text-sm text-stone-800">{p.full_name}</span>
                  {p.ensemble && (
                    <span className="text-xs text-stone-400">{p.ensemble}</span>
                  )}
                  {!p.phone && (
                    <span className="text-[10px] text-stone-300 ml-auto">no phone</span>
                  )}
                </label>
              ))}
            </div>
          )}

          {recipientCount > 0 && (
            <p className="text-xs text-stone-400 mt-2">
              {recipientCount} recipient{recipientCount !== 1 ? "s" : ""} selected
            </p>
          )}
        </div>

        {/* Channel */}
        <div>
          <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
            Channel
          </label>
          <div className="flex gap-2">
            {(["sms", "email", "both"] as const).map((ch) => (
              <button
                key={ch}
                onClick={() => setChannel(ch)}
                className={`text-sm px-3 py-1.5 rounded-md border transition-colors ${
                  channel === ch
                    ? "bg-stone-900 text-white border-stone-900"
                    : "border-stone-200 text-stone-600 hover:border-stone-400"
                }`}
              >
                {ch === "both" ? "SMS + Email" : ch.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* SMS Body */}
        {(channel === "sms" || channel === "both") && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider">
                SMS Message
              </label>
              <span className={`text-xs ${smsOver ? "text-red-500 font-semibold" : "text-stone-400"}`}>
                {smsChars}/{SMS_LIMIT}
              </span>
            </div>
            <textarea
              value={smsBody}
              onChange={(e) => setSmsBody(e.target.value)}
              rows={3}
              placeholder="Your message here..."
              className={`w-full text-sm border rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-1 ${
                smsOver
                  ? "border-red-300 focus:ring-red-400"
                  : "border-stone-200 focus:ring-stone-400"
              }`}
            />
            <p className="text-xs text-stone-400 mt-1">
              Only sent to members with SMS consent. Opt-out instructions are appended automatically.
            </p>
          </div>
        )}

        {/* Email */}
        {(channel === "email" || channel === "both") && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Email Subject
              </label>
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Subject line..."
                className="w-full text-sm border border-stone-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-stone-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Email Body
              </label>
              <textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={6}
                placeholder="Email body (plain text, double line breaks become paragraphs)..."
                className="w-full text-sm border border-stone-200 rounded-md px-3 py-2 resize-y focus:outline-none focus:ring-1 focus:ring-stone-400"
              />
            </div>
          </div>
        )}

        {/* Send Button */}
        <div className="flex justify-end pt-2">
          <button
            onClick={() => setShowConfirm(true)}
            disabled={!isValid || sending}
            className="px-6 py-2 rounded-lg bg-stone-900 text-white text-sm font-medium hover:bg-stone-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sending ? "Sending..." : "Send Message"}
          </button>
        </div>
      </div>

      {/* Sent Messages Log */}
      {logs.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-semibold text-stone-700 mb-3">Recent Sent Messages</h2>
          <div className="border border-stone-200 rounded-lg overflow-hidden bg-white">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50">
                  <th className="text-left text-[10px] uppercase tracking-wider font-semibold text-stone-500 px-4 py-2.5">Channel</th>
                  <th className="text-left text-[10px] uppercase tracking-wider font-semibold text-stone-500 px-4 py-2.5">Type</th>
                  <th className="text-left text-[10px] uppercase tracking-wider font-semibold text-stone-500 px-4 py-2.5">Status</th>
                  <th className="text-left text-[10px] uppercase tracking-wider font-semibold text-stone-500 px-4 py-2.5">Sent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {logs.map((log) => (
                  <LogRow key={log.id} log={log as NotificationLog} />
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-stone-400 mt-2">Showing last {logs.length} notifications (all types).</p>
        </div>
      )}

      {/* Confirm Dialog */}
      {showConfirm && (
        <ConfirmDialog
          recipientCount={recipientCount}
          channel={channel}
          onConfirm={handleSend}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}
