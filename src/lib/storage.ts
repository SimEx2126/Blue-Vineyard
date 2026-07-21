import { randomUUID } from "crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * Media storage on Wasabi (S3-compatible).
 *
 * Everything this app writes lives under a single prefix inside the shared
 * ACS bucket, so it can never collide with or read the rest of the org's data.
 * Both upload and download go through our own server, so the Wasabi keys never
 * reach the browser and the feature works whether the bucket is public or not.
 */

// The one drawer this app owns inside the shared bucket, split into a public
// area (event banners, served by anyone) and a private one (payment proofs,
// served only to the event's organiser through an auth-gated route).
export const MEDIA_PREFIX = "adventist-events/";
export const BANNER_PREFIX = "adventist-events/banners/";
export const PROOF_PREFIX = "adventist-events/proofs/";

const REQUIRED = [
  "WASABI_ACCESS_KEY_ID",
  "WASABI_SECRET_ACCESS_KEY",
  "WASABI_REGION",
  "WASABI_ENDPOINT",
  "WASABI_BUCKET",
] as const;

export function isStorageConfigured() {
  return REQUIRED.every((k) => !!process.env[k]);
}

let cached: S3Client | null = null;

function client() {
  if (!isStorageConfigured()) {
    throw new Error("Wasabi is not configured — set the WASABI_* variables in .env.local.");
  }
  if (!cached) {
    cached = new S3Client({
      region: process.env.WASABI_REGION,
      endpoint: process.env.WASABI_ENDPOINT,
      // Wasabi is addressed path-style (bucket in the path, not the hostname).
      forcePathStyle: process.env.WASABI_FORCE_PATH_STYLE !== "false",
      credentials: {
        accessKeyId: process.env.WASABI_ACCESS_KEY_ID!,
        secretAccessKey: process.env.WASABI_SECRET_ACCESS_KEY!,
      },
    });
  }
  return cached;
}

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

// SVG is deliberately excluded: it can carry scripts, and we serve media from
// our own origin. Raster formats only.
export function extensionForType(contentType: string): string | null {
  return EXT_BY_TYPE[contentType] ?? null;
}

/** Store a file and return the key it was stored under. */
export async function putMedia(body: Buffer, contentType: string, folder = "banners") {
  const ext = extensionForType(contentType);
  if (!ext) throw new Error(`Unsupported image type: ${contentType}`);
  const key = `${MEDIA_PREFIX}${folder}/${randomUUID()}.${ext}`;
  await client().send(
    new PutObjectCommand({
      Bucket: process.env.WASABI_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  return key;
}

/** Fetch a stored object. Callers must confirm the key is ours first. */
export async function getMedia(key: string) {
  const res = await client().send(
    new GetObjectCommand({ Bucket: process.env.WASABI_BUCKET, Key: key })
  );
  const bytes = await res.Body?.transformToByteArray();
  return { bytes, contentType: res.ContentType ?? "application/octet-stream" };
}

function safeKey(key: string) {
  return !key.includes("..") && !key.includes("//");
}

/**
 * Public banner keys only. The public /api/media route uses this so it can
 * never be turned into a reader for payment proofs or the rest of the bucket.
 */
export function isPublicBannerKey(key: string) {
  return key.startsWith(BANNER_PREFIX) && safeKey(key);
}

/** Payment-proof keys only, served through the auth-gated proof route. */
export function isProofKey(key: string) {
  return key.startsWith(PROOF_PREFIX) && safeKey(key);
}

/** The public in-app URL a banner key is served from. */
export function mediaUrl(key: string) {
  return `/api/media/${key}`;
}
