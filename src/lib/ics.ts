/**
 * Minimal iCalendar (.ics) builder — enough for a single event a registrant
 * can add to their phone calendar. No dependency: the format is plain text.
 */

function icsDate(d: Date) {
  // UTC basic format: 20260118T090000Z
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escape(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function buildEventIcs(input: {
  uid: string;
  title: string;
  start: Date;
  end?: Date | null;
  location?: string | null;
  description?: string | null;
  stampAt: Date;
}) {
  const end = input.end ?? new Date(input.start.getTime() + 60 * 60 * 1000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SNSW Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${input.uid}`,
    `DTSTAMP:${icsDate(input.stampAt)}`,
    `DTSTART:${icsDate(input.start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${escape(input.title)}`,
    input.location ? `LOCATION:${escape(input.location)}` : null,
    input.description ? `DESCRIPTION:${escape(input.description)}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  // iCalendar wants CRLF line endings.
  return lines.join("\r\n");
}
