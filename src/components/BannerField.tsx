"use client";

import { useRef, useState } from "react";

/**
 * Banner picker, shown beside the event form.
 *
 * There is no visible URL field any more, so the saved value rides in a hidden
 * input — without it the form would post an empty heroImageUrl and wipe the
 * banner of every event that was saved for any other reason.
 *
 * File storage is not connected yet, so a dropped image can only be previewed.
 * The box says so rather than appearing to work and losing the file on save.
 */
export function BannerField({ name, defaultValue }: { name: string; defaultValue?: string }) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [preview, setPreview] = useState<{ src: string; fileName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function takeFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("That file is not an image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Images must be under 5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPreview({ src: String(reader.result), fileName: file.name });
    reader.readAsDataURL(file);
  }

  const shown = preview?.src || url;

  return (
    <aside className="flex h-full flex-col rounded-xl border border-zinc-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-zinc-900">Event banner</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Portrait posters work best — this is what people see on the events page.
      </p>

      {/* Carries the saved value through the form. */}
      <input type="hidden" name={name} value={url} />

      <div
        role="button"
        tabIndex={0}
        aria-label="Choose a banner image"
        onClick={() => fileInput.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInput.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          takeFile(e.dataTransfer.files?.[0]);
        }}
        // Grows to fill the column so the panel matches the form's height,
        // rather than a fixed aspect ratio that would run to ~750px at this width.
        className={`mt-3 flex min-h-[18rem] w-full flex-1 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed p-3 text-center transition ${
          dragging ? "border-teal-600 bg-teal-50" : "border-zinc-300 bg-zinc-50 hover:border-zinc-400"
        }`}
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="Banner preview" className="max-h-full max-w-full object-contain" />
        ) : (
          <div className="px-3">
            <p className="text-sm font-medium text-zinc-600">Drop an image here</p>
            <p className="mt-1 text-xs text-zinc-500">or click to choose a file</p>
          </div>
        )}
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => takeFile(e.target.files?.[0])}
      />

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {preview && (
        <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2">
          <p className="text-xs font-medium text-amber-900">Preview only — not saved</p>
          <p className="mt-0.5 text-[11px] leading-snug text-amber-800">
            {preview.fileName} looks right, but image storage is not connected yet, so this file
            cannot be kept. The current banner is unchanged.
          </p>
          <button
            type="button"
            onClick={() => setPreview(null)}
            className="mt-1 text-[11px] font-medium text-amber-900 underline"
          >
            Clear preview
          </button>
        </div>
      )}

      {url && !preview && (
        <button
          type="button"
          onClick={() => setUrl("")}
          className="mt-2 text-xs text-zinc-500 hover:text-zinc-800 hover:underline"
        >
          Remove banner
        </button>
      )}
    </aside>
  );
}
