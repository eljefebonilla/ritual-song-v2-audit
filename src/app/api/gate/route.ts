import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { code } = await request.json();
  const accessCode = process.env.SITE_ACCESS_CODE;

  if (!code || code !== accessCode) {
    return NextResponse.json({ error: "Invalid code" }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set("rs_access", code, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 90, // 90 days
    path: "/",
  });

  return response;
}
