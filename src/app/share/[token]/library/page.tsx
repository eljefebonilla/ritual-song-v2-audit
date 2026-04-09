import { Suspense } from "react";
import { notFound } from "next/navigation";
import { loadSongLibrary } from "@/lib/song-library";
import SongLibraryShell from "@/components/library/SongLibraryShell";
import { getSharedView } from "@/lib/shared-view";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function ShareLibraryPage({ params }: Props) {
  const { token } = await params;
  const view = await getSharedView(token);
  if (!view || !view.config.types.includes("library")) notFound();

  const songs = await loadSongLibrary();

  return (
    <div className="h-full overflow-hidden">
      <Suspense>
        <SongLibraryShell songs={songs} />
      </Suspense>
    </div>
  );
}
