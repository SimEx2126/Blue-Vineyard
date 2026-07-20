"use client";

import { useState } from "react";

export function SharePanel({
  url,
  qrMarkup,
  slug,
}: {
  url: string;
  qrMarkup: string;
  slug: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is blocked on insecure origins; the field is selectable.
      setCopied(false);
    }
  }

  const qrHref = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrMarkup)}`;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <h2 className="text-lg font-semibold">Share this event</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Send the link or print the QR code so people register directly, without
        going through the events page.
      </p>

      <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
            Direct link
          </label>
          <div className="mt-1 flex gap-2">
            <input
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 font-mono text-xs"
            />
            <button
              type="button"
              onClick={copy}
              className="shrink-0 rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium hover:bg-zinc-100"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-xs text-teal-700 hover:underline"
          >
            Open the registration page →
          </a>
        </div>

        <div className="shrink-0 text-center">
          <div
            className="mx-auto h-32 w-32 [&>svg]:h-full [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: qrMarkup }}
          />
          <a
            href={qrHref}
            download={`${slug}-qr.svg`}
            className="mt-2 inline-block text-xs text-teal-700 hover:underline"
          >
            Download QR
          </a>
        </div>
      </div>
    </div>
  );
}
