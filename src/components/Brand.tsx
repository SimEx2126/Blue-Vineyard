import Link from "next/link";

/**
 * The SNSW Events wordmark — a teal calendar mark beside the name, with the
 * conference as a small kicker. Shared by the public site header and the admin
 * bar so both read as one product; `tone` flips it for dark backgrounds.
 */
export function Brand({
  href = "/",
  tone = "light",
  subtitle = "South NSW Conference",
}: {
  href?: string;
  tone?: "light" | "dark";
  subtitle?: string | null;
}) {
  const dark = tone === "dark";
  return (
    <Link href={href} className="group inline-flex items-center gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow-sm ring-1 ring-black/5 transition group-hover:shadow-md group-hover:brightness-105">
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
          <path d="M3 9.5h18" />
          <path d="M8 2.5v4M16 2.5v4" />
          <path d="m8.5 14.5 2.2 2.2 4-4.2" />
        </svg>
      </span>
      <span className="flex flex-col leading-none">
        <span className={`text-base font-bold tracking-tight ${dark ? "text-white" : "text-zinc-900"}`}>
          SNSW <span className={dark ? "text-teal-300" : "text-teal-600"}>Events</span>
        </span>
        {subtitle && (
          <span
            className={`mt-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${
              dark ? "text-zinc-400" : "text-zinc-400"
            }`}
          >
            {subtitle}
          </span>
        )}
      </span>
    </Link>
  );
}
