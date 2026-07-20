import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "SNSW Events",
  description: "Event registrations for the South New South Wales Conference.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-50 text-zinc-900 antialiased">
        <header className="border-b border-zinc-200 bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              SNSW <span className="text-teal-700">Events</span>
            </Link>
            <nav className="text-sm text-zinc-500">
              <Link href="/" className="hover:text-zinc-900">
                Current events
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
        <footer className="border-t border-zinc-200 py-6 text-center text-xs text-zinc-400">
          South New South Wales Conference &copy; {new Date().getFullYear()}
        </footer>
      </body>
    </html>
  );
}
