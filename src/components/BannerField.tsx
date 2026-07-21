"use client";

import { useRef, useState } from "react";

/**
 * Banner picker, shown beside the event form.
 *
 * A chosen file is uploaded to Wasabi straight away; on success the returned
 * URL is what the form saves. The saved value rides in a hidden input, so an
 * event saved for any other reason keeps whatever banner it already had.
 */
export function BannerField({ name, defaultValue }: { name: string; defaultValue?: string }) {
  const [url, setUrl] = useState(defaultValue ?? "");
  // A local data-URL preview shown instantly while the upload is in flight.
  const [pending, setPending] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function takeFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("That file is not an image.");
      return;
    }
    if (file.type === "image/svg+xml") {
      setError("SVG isn't supported — please use a PNG or JPG.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Images must be under 5 MB.");
      return;
    }

    // Show the picked image immediately, then upload behind it.
    const reader = new FileReader();
    reader.onload = () => setPending(String(reader.result));
    reader.readAsDataURL(file);
    setStatus("uploading");

    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/media/upload", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed.");
        setStatus("error");
        setPending(null);
        return;
      }
      setUrl(data.url);
      setPending(null);
      setStatus("idle");
    } catch {
      setError("Upload failed — check your connection and try again.");
      setStatus("error");
      setPending(null);
    }
  }

  const shown = pending || url;
  const uploading = status === "uploading";

  return (
    <aside className="flex h-full flex-col rounded-xl border border-zinc-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-zinc-900">Event banner</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Portrait posters work best — this is what people see on the events page.
      </p>

      {/* Carries the saved banner URL through the form. */}
      <input type="hidden" name={name} value={url} />

      <div
        role="button"
        tabIndex={0}
        aria-label="Choose a banner image"
        onClick={() => !uploading && fileInput.current?.click()}
        onKeyDown={(e) => {
          if (!uploading && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            fileInput.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!uploading) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!uploading) takeFile(e.dataTransfer.files?.[0]);
        }}
        className={`relative mt-3 flex min-h-[18rem] w-full flex-1 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed p-3 text-center transition ${
          dragging ? "border-teal-600 bg-teal-50" : "border-zinc-300 bg-zinc-50 hover:border-zinc-400"
        } ${uploading ? "cursor-wait" : ""}`}
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shown}
            alt="Banner preview"
            className={`max-h-full max-w-full object-contain ${uploading ? "opacity-60" : ""}`}
          />
        ) : (
          <div className="px-3">
            <p className="text-sm font-medium text-zinc-600">Drop an image here</p>
            <p className="mt-1 text-xs text-zinc-500">or click to choose a file</p>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50">
            <span className="rounded-full bg-zinc-900/80 px-3 py-1 text-xs font-medium text-white">
              Uploading…
            </span>
          </div>
        )}
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => takeFile(e.target.files?.[0])}
      />

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {url && !uploading && (
        <button
          type="button"
          onClick={() => {
            setUrl("");
            setError(null);
          }}
          className="mt-2 self-start text-xs text-zinc-500 hover:text-zinc-800 hover:underline"
        >
          Remove banner
        </button>
      )}
    </aside>
  );
}
