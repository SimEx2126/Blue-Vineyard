import { getMedia, isOwnedKey, isStorageConfigured } from "@/lib/storage";

/**
 * Serves a stored banner. Public — banners appear on the public events page —
 * but locked to this app's own prefix, so it can never be turned into a reader
 * for the rest of the shared ACS bucket.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  if (!isStorageConfigured()) {
    return new Response("Storage not configured", { status: 503 });
  }

  const { key: segments } = await ctx.params;
  const key = segments.map(decodeURIComponent).join("/");

  if (!isOwnedKey(key)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const { bytes, contentType } = await getMedia(key);
    if (!bytes) return new Response("Not found", { status: 404 });
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": contentType,
        // Keys are immutable (a new upload gets a new uuid), so cache hard.
        "Cache-Control": "public, max-age=31536000, immutable",
        // Never let a browser second-guess the type of stored bytes.
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
