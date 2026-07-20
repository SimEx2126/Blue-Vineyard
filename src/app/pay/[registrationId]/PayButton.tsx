"use client";

import { useState } from "react";

export function PayButton({
  registrationId,
  amountLabel,
}: {
  registrationId: number;
  amountLabel: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registrationId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Payment failed.");
      setBusy(false);
      return;
    }
    window.location.href = data.redirectUrl;
  }

  return (
    <div className="mt-6">
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <button
        onClick={pay}
        disabled={busy}
        className="w-full rounded-lg bg-teal-700 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
      >
        {busy ? "Processing…" : `Pay ${amountLabel}`}
      </button>
    </div>
  );
}
