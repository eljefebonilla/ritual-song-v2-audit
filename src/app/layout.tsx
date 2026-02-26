import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "St. Monica — Mass Preparation",
  description:
    "Liturgical mass preparation tool for St. Monica Catholic Community",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
