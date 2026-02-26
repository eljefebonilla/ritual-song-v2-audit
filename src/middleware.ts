import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Paths that don't require the access code gate
const PUBLIC_PATHS = ["/gate", "/auth/callback"];
const STATIC_PREFIXES = ["/_next/", "/api/", "/favicon.ico"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static assets and API routes through
  if (STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Allow public paths through
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Allow public logo files
  if (pathname.startsWith("/logo-")) {
    return NextResponse.next();
  }

  // Check access code gate
  const accessCookie = request.cookies.get("rs_access")?.value;
  const accessCode = process.env.SITE_ACCESS_CODE;

  if (!accessCookie || accessCookie !== accessCode) {
    const gateUrl = new URL("/gate", request.url);
    gateUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(gateUrl);
  }

  // Refresh Supabase auth session (keeps cookies fresh)
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
