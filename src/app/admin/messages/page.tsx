export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/admin";
import MessagesShell from "./MessagesShell";

export default async function MessagesPage() {
  const supabase = createAdminClient();

  // Fetch active profiles for custom recipient selector
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, ensemble, email, phone, sms_consent")
    .eq("status", "active")
    .order("full_name");

  // Fetch distinct ensembles
  const ensembles = Array.from(
    new Set((profiles ?? []).map((p) => p.ensemble).filter(Boolean))
  ).sort() as string[];

  // Fetch recent notification log (last 100)
  const { data: logs } = await supabase
    .from("notifications_log")
    .select("id, channel, message_type, status, created_at, recipient_id")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="min-h-screen">
      <MessagesShell
        profiles={profiles || []}
        ensembles={ensembles}
        initialLogs={logs || []}
      />
    </div>
  );
}
