import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

// Every page is rendered per request: the nonce of its policy (proxy.ts),
// the member the Chest asserts, the forms as they are now. Nothing is
// written to disk at run time — the Chest runs this server on a read-only
// file system.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Formulaires",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
