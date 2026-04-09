import { redirect } from "next/navigation";
import { verifyAdminStrict } from "@/lib/admin";
import { getAllFullOccasions } from "@/lib/data";
import { listSharedViews } from "@/lib/shared-view";
import ShareAdminClient from "./ShareAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminSharePage() {
  // Allow dev bypass via verifyAdmin (NOT Strict) so local work is unblocked,
  // but in prod this page still requires a real admin session.
  if (process.env.NODE_ENV !== "development") {
    const ok = await verifyAdminStrict();
    if (!ok) redirect("/");
  }

  const occasions = getAllFullOccasions();
  const existing = await listSharedViews();
  const occasionOptions = occasions.map((o) => ({
    id: o.id,
    name: o.name,
    year: o.year,
    season: o.season,
  }));

  return (
    <div className="min-h-screen bg-stone-50 p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-serif text-stone-900 mb-1">Public Share Views</h1>
      <p className="text-sm text-stone-600 mb-6">
        Generate read-only links to email. Recipients see exactly the weeks, ensembles,
        and tabs you configure. No login required on their end.
      </p>
      <ShareAdminClient occasions={occasionOptions} existing={existing} />
    </div>
  );
}
