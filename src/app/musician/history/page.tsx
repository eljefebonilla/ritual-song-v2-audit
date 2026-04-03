"use client";

import { useUser } from "@/lib/user-context";
import MusicianHistoryShell from "@/components/musician/MusicianHistoryShell";

/**
 * /musician/history — Private page for logged-in musicians to view their own history.
 * No server component needed: the API route handles auth + data fetching.
 */
export default function MusicianHistoryPage() {
  const { user, profile, isAuthenticated } = useUser();

  if (!isAuthenticated || !user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-muted">Please log in to view your history.</p>
      </div>
    );
  }

  return (
    <MusicianHistoryShell
      profileId={user.id}
      musicianName={profile?.full_name || "My History"}
    />
  );
}
