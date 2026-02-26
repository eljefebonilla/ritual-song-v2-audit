"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/user-context";

interface ComplianceType {
  id: string;
  name: string;
  description: string;
  renewal_months: number | null;
  info_url: string | null;
}

interface ComplianceRecord {
  id: string;
  user_id: string;
  compliance_type_id: string;
  completed_date: string | null;
  expiry_date: string | null;
  document_url: string | null;
  notes: string | null;
  verified_by: string | null;
}

type StatusKind = "current" | "expiring_soon" | "expired" | "not_submitted";

interface ComplianceItem {
  type: ComplianceType;
  record: ComplianceRecord | null;
  status: StatusKind;
}

function getComplianceStatus(record: ComplianceRecord | null): StatusKind {
  if (!record || !record.completed_date) return "not_submitted";

  if (!record.expiry_date) return "current";

  const now = new Date();
  const expiry = new Date(record.expiry_date);
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  if (expiry < now) return "expired";
  if (expiry <= thirtyDaysFromNow) return "expiring_soon";
  return "current";
}

const STATUS_CONFIG: Record<
  StatusKind,
  { label: string; bg: string; text: string; dot: string }
> = {
  current: {
    label: "Current",
    bg: "bg-green-50",
    text: "text-green-700",
    dot: "bg-green-500",
  },
  expiring_soon: {
    label: "Expiring Soon",
    bg: "bg-yellow-50",
    text: "text-yellow-700",
    dot: "bg-yellow-500",
  },
  expired: {
    label: "Expired",
    bg: "bg-red-50",
    text: "text-red-700",
    dot: "bg-red-500",
  },
  not_submitted: {
    label: "Not Submitted",
    bg: "bg-stone-100",
    text: "text-stone-500",
    dot: "bg-stone-400",
  },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "--";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function CompliancePage() {
  const { user } = useUser();
  const [items, setItems] = useState<ComplianceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingTypeId, setUploadingTypeId] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const fetchData = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();

    // Fetch compliance types and user's records in parallel
    const [typesResult, recordsResult] = await Promise.all([
      supabase.from("compliance_types").select("*").order("name"),
      supabase
        .from("compliance_records")
        .select("*")
        .eq("user_id", user.id),
    ]);

    const types = (typesResult.data ?? []) as ComplianceType[];
    const records = (recordsResult.data ?? []) as ComplianceRecord[];

    const recordsByType = new Map<string, ComplianceRecord>();
    for (const r of records) {
      recordsByType.set(r.compliance_type_id, r);
    }

    const merged: ComplianceItem[] = types.map((type) => {
      const record = recordsByType.get(type.id) ?? null;
      return {
        type,
        record,
        status: getComplianceStatus(record),
      };
    });

    setItems(merged);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  async function handleFileUpload(
    complianceTypeId: string,
    file: File
  ) {
    if (!user) return;

    setUploadingTypeId(complianceTypeId);
    const supabase = createClient();

    // Sanitize filename
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${user.id}/${complianceTypeId}_${Date.now()}_${safeName}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("compliance-docs")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      setToast({
        type: "error",
        message: `Upload failed: ${uploadError.message}`,
      });
      setUploadingTypeId(null);
      return;
    }

    // Get the public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("compliance-docs").getPublicUrl(uploadData.path);

    // Check if record already exists
    const existingRecord = items.find(
      (i) => i.type.id === complianceTypeId
    )?.record;

    if (existingRecord) {
      // Update existing record
      const { error: updateError } = await supabase
        .from("compliance_records")
        .update({
          document_url: publicUrl,
          completed_date: new Date().toISOString().split("T")[0],
          expiry_date: calculateExpiry(complianceTypeId),
        })
        .eq("id", existingRecord.id);

      if (updateError) {
        setToast({ type: "error", message: "Failed to update compliance record." });
      } else {
        setToast({ type: "success", message: "Document uploaded and record updated." });
      }
    } else {
      // Create new record
      const { error: insertError } = await supabase
        .from("compliance_records")
        .insert({
          user_id: user.id,
          compliance_type_id: complianceTypeId,
          document_url: publicUrl,
          completed_date: new Date().toISOString().split("T")[0],
          expiry_date: calculateExpiry(complianceTypeId),
        });

      if (insertError) {
        setToast({ type: "error", message: "Failed to create compliance record." });
      } else {
        setToast({ type: "success", message: "Document uploaded successfully." });
      }
    }

    setUploadingTypeId(null);
    fetchData();
  }

  function calculateExpiry(typeId: string): string | null {
    const item = items.find((i) => i.type.id === typeId);
    if (!item?.type.renewal_months) return null;

    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + item.type.renewal_months);
    return expiry.toISOString().split("T")[0];
  }

  function triggerFileInput(typeId: string) {
    const input = fileInputRefs.current[typeId];
    if (input) {
      input.click();
    }
  }

  // Count statuses for summary
  const statusCounts = items.reduce(
    (acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    },
    {} as Record<StatusKind, number>
  );

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-stone-200 rounded w-1/3" />
            <div className="grid grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 bg-stone-100 rounded-lg" />
              ))}
            </div>
            <div className="space-y-3 mt-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-28 bg-stone-100 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`rounded-lg px-4 py-3 text-sm font-medium flex items-center gap-2 ${
            toast.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {toast.type === "success" ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
          {toast.message}
        </div>
      )}

      {/* Summary Card */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm">
        <div className="px-6 py-4 border-b border-stone-100">
          <h2 className="text-lg font-semibold text-stone-900">
            Compliance Status
          </h2>
          <p className="text-sm text-stone-500 mt-0.5">
            Archdiocesan compliance requirements for music ministry volunteers.
          </p>
        </div>

        {/* Status Summary Badges */}
        {items.length > 0 && (
          <div className="px-6 py-4 border-b border-stone-100">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(
                [
                  "current",
                  "expiring_soon",
                  "expired",
                  "not_submitted",
                ] as StatusKind[]
              ).map((status) => {
                const config = STATUS_CONFIG[status];
                const count = statusCounts[status] ?? 0;
                return (
                  <div
                    key={status}
                    className={`${config.bg} rounded-lg p-3 text-center`}
                  >
                    <p className={`text-2xl font-bold ${config.text}`}>
                      {count}
                    </p>
                    <p className={`text-xs font-medium ${config.text}`}>
                      {config.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Compliance Items */}
        <div className="divide-y divide-stone-100">
          {items.length === 0 && (
            <div className="p-8 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-stone-300 mb-3">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              <p className="text-stone-500 text-sm">
                No compliance requirements configured yet.
              </p>
              <p className="text-stone-400 text-xs mt-1">
                Your music director will set up the required compliance items.
              </p>
            </div>
          )}

          {items.map((item) => {
            const config = STATUS_CONFIG[item.status];
            const isUploading = uploadingTypeId === item.type.id;

            return (
              <div key={item.type.id} className="px-6 py-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  {/* Left: Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-stone-900">
                        {item.type.name}
                      </h3>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${config.bg} ${config.text}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${config.dot}`}
                        />
                        {config.label}
                      </span>
                    </div>

                    {item.type.description && (
                      <p className="text-sm text-stone-500 mb-2">
                        {item.type.description}
                      </p>
                    )}

                    {/* Dates */}
                    {item.record && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
                        <span>
                          Completed:{" "}
                          <span className="text-stone-700">
                            {formatDate(item.record.completed_date)}
                          </span>
                        </span>
                        {item.record.expiry_date && (
                          <span>
                            Expires:{" "}
                            <span
                              className={
                                item.status === "expired"
                                  ? "text-red-600 font-medium"
                                  : item.status === "expiring_soon"
                                    ? "text-yellow-600 font-medium"
                                    : "text-stone-700"
                              }
                            >
                              {formatDate(item.record.expiry_date)}
                            </span>
                          </span>
                        )}
                        {item.record.verified_by && (
                          <span>
                            Verified by:{" "}
                            <span className="text-stone-700">
                              {item.record.verified_by}
                            </span>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Renewal info */}
                    {item.type.renewal_months && (
                      <p className="text-xs text-stone-400 mt-1">
                        Renewal required every {item.type.renewal_months} months
                      </p>
                    )}
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Info URL link */}
                    {item.type.info_url && (
                      <a
                        href={item.type.info_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 text-xs font-medium text-parish-burgundy border border-parish-burgundy/30 rounded-lg hover:bg-parish-burgundy/5 transition-colors flex items-center gap-1.5"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                        Register
                      </a>
                    )}

                    {/* Upload button */}
                    <button
                      onClick={() => triggerFileInput(item.type.id)}
                      disabled={isUploading}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-parish-burgundy rounded-lg hover:bg-parish-burgundy/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {isUploading ? (
                        <>
                          <svg
                            className="animate-spin"
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                          </svg>
                          Uploading...
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                          </svg>
                          Upload Doc
                        </>
                      )}
                    </button>

                    {/* Hidden file input */}
                    <input
                      ref={(el) => {
                        fileInputRefs.current[item.type.id] = el;
                      }}
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleFileUpload(item.type.id, file);
                          // Reset input so same file can be re-uploaded
                          e.target.value = "";
                        }
                      }}
                    />

                    {/* View document link */}
                    {item.record?.document_url && (
                      <a
                        href={item.record.document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-stone-400 hover:text-parish-burgundy hover:bg-stone-50 rounded transition-colors"
                        title="View uploaded document"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                          <polyline points="10 9 9 9 8 9" />
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
