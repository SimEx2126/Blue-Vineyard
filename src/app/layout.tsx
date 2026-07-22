import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: "SNSW Events",
  description: "Event registrations for the South New South Wales Conference.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-50 text-zinc-900 antialiased">
        <SiteHeader />
        <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
        <footer className="border-t border-zinc-200 py-6 text-center text-xs text-zinc-400">
          <p>South New South Wales Conference &copy; {new Date().getFullYear()}</p>
          {/* The one way in for organisers. /admin sends them to the sign-in
              page or straight to their dashboard if they are already signed in. */}
          <p className="mt-2">
            <Link href="/admin" className="hover:text-zinc-600 hover:underline">
              Organiser sign in
            </Link>
          </p>
        </footer>
      </body>
    </html>
  );
}
