import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

const ENSEMBLE_LABELS: Record<string, string> = {
  reflections: "Reflections",
  foundations: "Foundations",
  generations: "Generations",
  heritage: "Heritage",
  elevations: "Elevations",
};

const ROLE_LABELS: Record<string, string> = {
  vocalist: "Vocalist",
  instrumentalist: "Instrumentalist",
  cantor: "Cantor",
  both: "Vocalist + Instrumentalist",
};

export default async function PendingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/join");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, ensemble, musician_role, voice_part, status")
    .eq("id", user.id)
    .single();

  // If active, they've been approved since last visit
  if (profile?.status === "active") {
    redirect("/");
  }

  // If no profile exists, send to onboarding
  if (!profile) {
    redirect("/onboard");
  }

  const ensembleLabel = profile.ensemble
    ? ENSEMBLE_LABELS[profile.ensemble] || profile.ensemble
    : null;
  const roleLabel = profile.musician_role
    ? ROLE_LABELS[profile.musician_role] || profile.musician_role
    : null;

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        {/* Check circle icon */}
        <div className="mb-6">
          <svg
            className="mx-auto w-16 h-16 text-violet-500"
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="32"
              cy="32"
              r="28"
              stroke="currentColor"
              strokeWidth="3"
              strokeDasharray="6 4"
            />
            <path
              d="M22 32l6 6 14-14"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-semibold text-stone-900 mb-2">
          You&apos;re almost in!
        </h1>
        <p className="text-stone-600 text-sm mb-8 leading-relaxed">
          An admin will review your application shortly.
          You&apos;ll receive a notification when you&apos;re approved.
        </p>

        {/* Profile summary */}
        <div className="bg-white rounded-xl border border-stone-200 p-5 text-left mb-6">
          <h2 className="text-xs uppercase tracking-wider text-stone-400 font-semibold mb-3">
            Your Application
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-stone-500">Name</dt>
              <dd className="text-stone-900 font-medium">
                {profile.full_name}
              </dd>
            </div>
            {roleLabel && (
              <div className="flex justify-between">
                <dt className="text-stone-500">Role</dt>
                <dd className="text-stone-900">{roleLabel}</dd>
              </div>
            )}
            {profile.voice_part && (
              <div className="flex justify-between">
                <dt className="text-stone-500">Voice Part</dt>
                <dd className="text-stone-900 capitalize">
                  {profile.voice_part}
                </dd>
              </div>
            )}
            {ensembleLabel && (
              <div className="flex justify-between">
                <dt className="text-stone-500">Ensemble</dt>
                <dd className="text-stone-900">{ensembleLabel}</dd>
              </div>
            )}
          </dl>
        </div>

        <Link
          href="/onboard"
          className="text-sm text-violet-600 hover:text-violet-700 transition-colors"
        >
          Edit your info
        </Link>

        <p className="mt-8 text-xs text-stone-400">
          Questions? Contact{" "}
          <a
            href="mailto:music@stmonica.net"
            className="text-stone-500 hover:text-stone-700 transition-colors underline"
          >
            music@stmonica.net
          </a>
        </p>
      </div>
    </div>
  );
}
