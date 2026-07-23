"use client";

import { useState } from "react";

/**
 * A 1–5 star picker that writes to a hidden form field, so it drops into a
 * plain server-action <form>. Hovering previews, clicking selects.
 */
export function StarRating({
  name = "rating",
  defaultValue = 0,
}: {
  name?: string;
  defaultValue?: number;
}) {
  const [value, setValue] = useState(defaultValue);
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  return (
    <div className="flex items-center gap-2">
      <input type="hidden" name={name} value={value} />
      <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setValue(n)}
            onMouseEnter={() => setHover(n)}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            aria-pressed={value === n}
            className={`text-4xl leading-none transition ${
              shown >= n ? "text-amber-400" : "text-zinc-300 hover:text-amber-200"
            }`}
          >
            ★
          </button>
        ))}
      </div>
      <span className="ml-1 w-16 text-sm text-zinc-500">
        {value ? `${value} / 5` : ""}
      </span>
    </div>
  );
}
