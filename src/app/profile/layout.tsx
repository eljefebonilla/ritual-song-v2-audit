"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@/lib/user-context";
import { useEffect } from "react";

const PROFILE_TABS = [
  { href: "/profile", label: "Profile", exact: true },
  { href: "/profile/emergency", label: "Emergency Contacts", exact: false },
  { href: "/profile/compliance", label: "Compliance", exact: false },
];

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, displayName, profile } = useUser();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-stone-400">Redirecting to login...</div>
      </div>
    );
  }

  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-white border-b border-stone-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={displayName}
                className="w-14 h-14 rounded-full object-cover border-2 border-parish-gold/30"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-parish-burgundy flex items-center justify-center text-white font-semibold text-lg border-2 border-parish-gold/30">
                {initials}
              </div>
            )}
            <div>
              <h1 className="text-xl font-semibold text-stone-900">
                {displayName}
              </h1>
              <p className="text-sm text-stone-500">
                {profile?.email ?? "Member"}
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-1 -mb-px overflow-x-auto" aria-label="Profile navigation">
            {PROFILE_TABS.map((tab) => {
              const isActive = tab.exact
                ? pathname === tab.href
                : pathname.startsWith(tab.href);

              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? "border-parish-gold text-parish-burgundy"
                      : "border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-300"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Page Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </div>
    </div>
  );
}
