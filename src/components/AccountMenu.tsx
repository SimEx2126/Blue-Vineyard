"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The admin account chip and its dropdown (identity + Sign out). A client
 * component so it closes on an outside click or Escape, not only on re-toggling
 * — the plain <details> it replaced stayed open until clicked again. The logout
 * server action is passed in from the server layout.
 */
export function AccountMenu({
  name,
  initials,
  badge,
  logoutAction,
}: {
  name: string;
  initials: string;
  badge: { label: string; cls: string };
  logoutAction: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative ml-auto" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex cursor-pointer select-none items-center gap-2 rounded-full py-1 pl-1 pr-2 text-zinc-200 transition hover:bg-white/10"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-teal-600 text-xs font-bold text-white ring-2 ring-white/10">
          {initials}
        </span>
        <span className="hidden max-w-[10rem] truncate text-sm font-medium sm:block">{name}</span>
        <svg
          className={`h-3.5 w-3.5 text-zinc-400 transition ${open ? "rotate-180" : ""}`}
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
        >
          <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl">
          <div className="border-b border-zinc-100 px-4 py-3">
            <p className="truncate text-sm font-semibold text-zinc-900">{name}</p>
            <span
              className={`mt-1.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white ${badge.cls}`}
            >
              {badge.label}
            </span>
          </div>
          <form action={logoutAction}>
            <button className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-50">
              <svg className="h-4 w-4 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="m16 17 5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
