"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string };

export function AdminNav({ items }: { items: Item[] }) {
  const pathname = usePathname();

  // Dashboard lives at /admin, which prefixes every other section, so it only
  // lights up on an exact match. The rest match their whole subtree, keeping
  // "Events" highlighted while you are inside an event's registrations.
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <nav className="flex flex-wrap gap-1">
      {items.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 transition ${
              active
                ? "bg-white/15 font-semibold text-white"
                : "text-zinc-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
