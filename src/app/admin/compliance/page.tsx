export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/admin";
import ComplianceShell from "@/components/admin/ComplianceShell";

export default async function CompliancePage() {
  const supabase = createAdminClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, ensemble, role")
    .order("full_name");

  const { data: complianceTypes } = await supabase
    .from("compliance_types")
    .select("id, name, description, renewal_months, info_url")
    .order("name");

  const { data: records } = await supabase
    .from("compliance_records")
    .select("id, user_id, compliance_type_id, completed_date, expiry_date, document_url, notes, verified_by");

  return (
    <div className="min-h-screen">
      <ComplianceShell
        profiles={profiles || []}
        complianceTypes={complianceTypes || []}
        records={records || []}
      />
    </div>
  );
}
