"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import MediaPlayer from "./MediaPlayer";

const FULL_SCREEN_PATHS = ["/gate", "/auth"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullScreen = FULL_SCREEN_PATHS.some((p) => pathname.startsWith(p));
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (isFullScreen) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-3 left-3 z-40 p-2 rounded-lg bg-stone-900 text-white shadow-lg md:hidden"
        aria-label="Open menu"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="20" y2="18" />
        </svg>
      </button>

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="min-h-screen md:ml-64">{children}</main>
      <MediaPlayer />
    </>
  );
}
