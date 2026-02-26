"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

const FULL_SCREEN_PATHS = ["/gate", "/auth"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullScreen = FULL_SCREEN_PATHS.some((p) => pathname.startsWith(p));

  if (isFullScreen) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <>
      <Sidebar />
      <main className="ml-64 min-h-screen">{children}</main>
    </>
  );
}
