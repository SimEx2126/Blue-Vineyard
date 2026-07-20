"use client";

import { useRef, useState } from "react";

/**
 * Banner picker for the event form.
 *
 * The drop box previews a chosen file, but file storage is not connected yet,
 * so a dropped image cannot be saved. Rather than silently discarding it on
 * save, the box says so plainly and the URL underneath remains the field that
 * actually persists.
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
    <div className="grid gap-4 sm:grid-cols-[1fr_14rem] sm:items-start">
      <div>
        <label className="block text-sm font-medium text-zinc-700">
          Banner image URL
          <input
            name={name}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="/demo-banners/example.svg or https://…"
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
          />
        </label>
        <p className="mt-1 text-xs text-zinc-500">
          Portrait posters work best. This is what people see on the events page.
        </p>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>

      <div>
        <div
          role="button"
          tabIndex={0}
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
          className={`flex aspect-[4/5] w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed text-center transition ${
            dragging
              ? "border-teal-600 bg-teal-50"
              : "border-zinc-300 bg-zinc-50 hover:border-zinc-400"
          }`}
        >
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="Banner preview" className="h-full w-full object-contain" />
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

        {preview ? (
          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2">
            <p className="text-xs font-medium text-amber-900">Preview only — not saved</p>
            <p className="mt-0.5 text-[11px] leading-snug text-amber-800">
              {preview.fileName} looks right, but image storage is not connected yet, so this file
              will not be kept. Paste a URL on the left to set the banner for now.
            </p>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="mt-1 text-[11px] font-medium text-amber-900 underline"
            >
              Clear preview
            </button>
          </div>
        ) : (
          url && (
            <button
              type="button"
              onClick={() => setUrl("")}
              className="mt-2 text-xs text-zinc-500 hover:text-zinc-800 hover:underline"
            >
              Remove banner
            </button>
          )
        )}
      </div>
    </div>
  );
}
