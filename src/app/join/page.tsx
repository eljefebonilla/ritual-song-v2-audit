import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { JoinForm } from "./join-form";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function JoinPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If already authenticated, check profile status
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
    // No profile yet — they need to onboard
    if (!profile) {
      redirect("/onboard");
    }
  }

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
          Join St. Monica Music Ministry
        </h1>
        <p className="text-stone-600 text-sm mb-8 leading-relaxed">
          Sign up to coordinate music, view schedules, and access resources
          for our worship community.
        </p>

        <JoinForm />

        <div className="mt-8 pt-6 border-t border-stone-200">
          <p className="text-xs text-stone-500 mb-4">
            Or text <span className="font-semibold">JOIN</span> to{" "}
            <span className="font-semibold">(323) 872-0954</span>
          </p>
          <Link
            href="/auth/login"
            className="text-sm text-violet-600 hover:text-violet-700 transition-colors"
          >
            Already have an account? Sign in
          </Link>
        </div>

        <div className="mt-6 flex items-center justify-center gap-4 text-[11px] text-stone-400">
          <Link href="/privacy" className="hover:text-stone-600 transition-colors">
            Privacy
          </Link>
          <span>|</span>
          <Link href="/terms" className="hover:text-stone-600 transition-colors">
            Terms
          </Link>
        </div>
      </div>
    </div>
  );
}
