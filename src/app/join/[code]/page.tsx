import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { JoinForm } from "../join-form";
import Link from "next/link";

export const dynamic = "force-dynamic";

const ENSEMBLE_LABELS: Record<string, string> = {
  reflections: "Reflections",
  foundations: "Foundations",
  generations: "Generations",
  heritage: "Heritage",
  elevations: "Elevations",
};

export default async function InviteJoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  // Check if current user is already authenticated
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", user.id)
      .single();

    if (profile?.status === "active") {
      redirect("/");
    }
    if (profile?.status === "pending") {
      redirect("/pending");
    }
    if (!profile) {
      redirect(`/onboard?invite=${code}`);
    }
  }

  // Look up invitation using admin client (RLS blocks anonymous users)
  const admin = createAdminClient();
  const { data: invitation } = await admin
    .from("invitations")
    .select("code, ensemble, status, expires_at")
    .eq("code", code)
    .single();

  // Invalid or expired invite
  if (
    !invitation ||
    invitation.status !== "pending" ||
    (invitation.expires_at && new Date(invitation.expires_at) < new Date())
  ) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="mb-6">
            <svg
              className="mx-auto w-12 h-12 text-stone-400"
              viewBox="0 0 48 48"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                cx="24"
                cy="24"
                r="20"
                stroke="currentColor"
                strokeWidth="3"
              />
              <path
                d="M16 16l16 16M32 16L16 32"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-stone-900 mb-2">
            Invite Not Found
          </h1>
          <p className="text-stone-600 text-sm mb-6">
            This invite link is invalid or has expired.
          </p>
          <Link
            href="/join"
            className="inline-block px-6 py-3 rounded-lg bg-violet-600 text-white font-semibold hover:bg-violet-700 transition-colors"
          >
            Sign Up Without Invite
          </Link>
        </div>
      </div>
    );
  }

  // Valid invitation
  const ensembleName = invitation.ensemble
    ? ENSEMBLE_LABELS[invitation.ensemble] || invitation.ensemble
    : null;

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        {/* Cross mark */}
        <div className="mb-6">
          <svg
            className="mx-auto w-12 h-12 text-violet-600"
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M24 4v40M12 16h24"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-semibold text-stone-900 mb-2">
          You&apos;re Invited
        </h1>
        <p className="text-stone-600 text-sm mb-8 leading-relaxed">
          Join St. Monica Music Ministry
          {ensembleName && (
            <>
              {" "}
              &mdash; <span className="font-medium">{ensembleName}</span>
            </>
          )}
          . Create your account to get started.
        </p>

        <JoinForm inviteCode={code} />

        <div className="mt-8 flex items-center justify-center gap-4 text-[11px] text-stone-400">
          <Link
            href="/privacy"
            className="hover:text-stone-600 transition-colors"
          >
            Privacy
          </Link>
          <span>|</span>
          <Link
            href="/terms"
            className="hover:text-stone-600 transition-colors"
          >
            Terms
          </Link>
        </div>
      </div>
    </div>
  );
}
