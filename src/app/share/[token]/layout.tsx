import { notFound } from "next/navigation";
import Link from "next/link";
import { getSharedView, SHARED_VIEW_TYPE_LABELS, type SharedViewType } from "@/lib/shared-view";
import { ViewerUserProvider } from "@/lib/user-context";
import { ViewerModeProvider } from "@/lib/viewer-mode";
import { MediaProvider } from "@/lib/media-context";
import MediaPlayer from "@/components/layout/MediaPlayer";

export const dynamic = "force-dynamic";

interface ShareLayoutProps {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}

export default async function ShareLayout({ children, params }: ShareLayoutProps) {
  const { token } = await params;
  const view = await getSharedView(token);
  if (!view) {
    notFound();
  }

  const TYPE_HREFS: Record<SharedViewType, string> = {
    planner: `/share/${view.id}/planner`,
    calendar: `/share/${view.id}/calendar`,
    library: `/share/${view.id}/library`,
  };

  const enabledTypes = view.config.types.filter((t): t is SharedViewType =>
    t === "planner" || t === "calendar" || t === "library"
  );

  return (
    <ViewerUserProvider>
      <ViewerModeProvider isViewer>
        <MediaProvider>
          <div className="min-h-screen flex flex-col bg-stone-50">
            <header className="bg-white border-b border-stone-200 flex-shrink-0">
              <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="font-serif text-base sm:text-lg text-stone-900 truncate">
                    {view.name}
                  </div>
                  <div className="text-[11px] text-stone-500 uppercase tracking-wide">
                    View-only · Shared preview
                  </div>
                </div>
              </div>
              <nav className="flex items-center gap-1 px-2 sm:px-4 border-t border-stone-100">
                {enabledTypes.map((type) => (
                  <Link
                    key={type}
                    href={TYPE_HREFS[type]}
                    className="px-4 py-2 text-sm text-stone-700 hover:text-stone-900 hover:bg-stone-100 rounded-t transition-colors"
                  >
                    {SHARED_VIEW_TYPE_LABELS[type]}
                  </Link>
                ))}
              </nav>
            </header>
            <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
            <MediaPlayer />
          </div>
        </MediaProvider>
      </ViewerModeProvider>
    </ViewerUserProvider>
  );
}
