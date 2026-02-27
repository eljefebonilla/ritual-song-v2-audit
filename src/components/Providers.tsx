"use client";

import { UserProvider } from "@/lib/user-context";
import { MediaProvider } from "@/lib/media-context";
import type { ReactNode } from "react";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <UserProvider>
      <MediaProvider>{children}</MediaProvider>
    </UserProvider>
  );
}
