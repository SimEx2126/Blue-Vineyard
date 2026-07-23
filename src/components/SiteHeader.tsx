"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "./Brand";

/**
 * The public site header. Admin routes render their own dark bar, so this
 * hides there rather than stacking a second header on top of it.
 */
export function SiteHeader() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Brand href="/" />
        <nav className="flex items-center gap-1.5">
          <Link
            href="/"
            className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
          >
            Current events
          </Link>
          <Link
            href="/admin"
            className="rounded-lg bg-teal-700 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800"
          >
            Organiser
          </Link>
        </nav>
      </div>
    </header>
  );
}
