import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/access";
import { extensionForType, isStorageConfigured, mediaUrl, putMedia } from "@/lib/storage";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Accepts an image from the banner picker and stores it in Wasabi. Only
 * signed-in organisers may upload, and only raster images up to 5 MB. Returns
 * the in-app URL the image is served from, which the form saves as the banner.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  if (!isStorageConfigured()) {
    return NextResponse.json(
      { error: "Image storage is not set up yet. Add the WASABI_* keys to .env.local." },
      { status: 503 }
    );
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file received." }, { status: 400 });
  }
  if (!extensionForType(file.type)) {
    return NextResponse.json(
      { error: "Please upload a PNG, JPG, WebP or GIF image." },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Images must be under 5 MB." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    const key = await putMedia(buffer, file.type);
    return NextResponse.json({ url: mediaUrl(key) });
  } catch (err) {
    console.error("[media upload] failed:", err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 502 });
  }
}
