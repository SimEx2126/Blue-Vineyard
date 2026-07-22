"use client";

import { useState } from "react";

/**
 * A small QR button on the event page. Opens a card with the event's QR code
 * and direct link, so anyone can share the event or post it on social media.
 */
export function ShareQrButton({ url, qrMarkup }: { url: string; qrMarkup: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const qrHref = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrMarkup)}`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Share this event — QR code and link"
        title="Share this event"
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50"
      >
        {/* QR glyph */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M3 3h8v8H3V3Zm2 2v4h4V5H5Zm8-2h8v8h-8V3Zm2 2v4h4V5h-4ZM3 13h8v8H3v-8Zm2 2v4h4v-4H5Zm10-2h2v2h-2v-2Zm4 0h2v2h-2v-2Zm-4 4h2v2h-2v-2Zm4 0h2v2h-2v-2Zm-4 4h2v2h-2v-2Zm4 0h2v2h-2v-2Z" />
        </svg>
      </button>

      {open && (
        <>
          {/* Backdrop: click anywhere outside to close. Fixed positioning so
              the card never clips inside scrollable tables. */}
          <div
            className="fixed inset-0 z-20 bg-black/30"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="fixed left-1/2 top-1/2 z-30 w-72 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-200 bg-white p-4 shadow-xl">
          <p className="text-sm font-semibold text-zinc-900">Share this event</p>
          <div
            className="mx-auto mt-3 w-44 rounded-lg border border-zinc-200 p-2 [&_svg]:h-auto [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: qrMarkup }}
          />
          <div className="mt-3 flex gap-2">
            <input
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-zinc-50 px-2 py-1.5 font-mono text-[11px]"
            />
            <button
              type="button"
              onClick={copy}
              className="shrink-0 rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium hover:bg-zinc-100"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <a
            href={qrHref}
            download="event-qr.svg"
            className="mt-2 inline-block text-xs font-medium text-teal-700 hover:underline"
          >
            Download QR code
          </a>
          </div>
        </>
      )}
    </div>
  );
}
