import QRCode from "qrcode";

/**
 * Rendered on the server so no QR library is shipped to registrants — the
 * admin page receives finished SVG markup.
 */
export async function qrSvg(text: string) {
  return QRCode.toString(text, {
    type: "svg",
    margin: 1,
    // Posters get photographed in poor light; the higher correction level
    // survives a partly obscured or creased print.
    errorCorrectionLevel: "M",
    width: 240,
  });
}

export function publicEventUrl(slug: string) {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/e/${slug}`;
}

/**
 * A ready-to-post caption for social media: the event title, when and where,
 * and the registration link. The organiser copies this and pastes it into a
 * post.
 */
export function eventShareText(
  event: { title: string; startsAt: Date | null; location: string | null },
  url: string
) {
  const lines = [event.title];
  const meta: string[] = [];
  if (event.startsAt) {
    meta.push(
      event.startsAt.toLocaleDateString("en-AU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    );
  }
  if (event.location) meta.push(event.location);
  if (meta.length) lines.push(meta.join(" · "));
  lines.push(`Register here: ${url}`);
  return lines.join("\n");
}
