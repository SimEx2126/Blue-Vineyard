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
