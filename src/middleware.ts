import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Paths that bypass the access code gate but KEEP auth session refresh
// Note: /api/ routes are already handled by STATIC_PREFIXES below
const GATE_BYPASS_PATHS = [
  "/gate",
  "/auth/callback",
  "/join",
  "/onboard",
  "/pending",
  "/privacy",
  "/terms",
];

const STATIC_PREFIXES = ["/_next/", "/api/", "/favicon.ico"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static assets and API routes through
  if (STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Allow public logo files
  if (pathname.startsWith("/logo-")) {
    return NextResponse.next();
  }

  // Gate-bypass paths — skip access code, but still refresh auth session
  const bypassGate =
    GATE_BYPASS_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (!bypassGate) {
    // Check access code gate
    const accessCookie = request.cookies.get("rs_access")?.value;
    const accessCode = process.env.SITE_ACCESS_CODE;

    if (!accessCookie || accessCookie !== accessCode) {
      const gateUrl = new URL("/gate", request.url);
      gateUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(gateUrl);
    }
  }

  // Refresh Supabase auth session (keeps cookies fresh)
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Skip session refresh if Supabase env vars aren't available
  if (!supabaseUrl || !supabaseKey) {
    return response;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session so it doesn't expire
  const { data: { user } } = await supabase.auth.getUser();

  // For authenticated users on gated paths (main app), check pending status
  if (user && !bypassGate) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", user.id)
      .single();

    if (profile?.status === "pending") {
      return NextResponse.redirect(new URL("/pending", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
