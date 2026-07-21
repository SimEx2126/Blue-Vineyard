// A plain, table-based HTML shell for emails — the markup that survives the
// widest range of mail clients. Kept deliberately simple and inline-styled.

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function emailLayout(opts: { heading: string; bodyHtml: string; footer?: string }) {
  const footer =
    opts.footer ?? "South New South Wales Conference of the Seventh-day Adventist Church";
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#18181b;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;overflow:hidden;">
          <tr><td style="background:#0f766e;padding:18px 28px;">
            <span style="color:#ffffff;font-size:18px;font-weight:700;">SNSW Events</span>
          </td></tr>
          <tr><td style="padding:28px;">
            <h1 style="margin:0 0 16px;font-size:20px;">${escapeHtml(opts.heading)}</h1>
            ${opts.bodyHtml}
          </td></tr>
          <tr><td style="padding:16px 28px;border-top:1px solid #e4e4e7;color:#71717a;font-size:12px;">
            ${escapeHtml(footer)}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export { escapeHtml };
