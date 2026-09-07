/** Shared iCalendar helpers for invitations and CalDAV. */

export type IcsAttendee = {
  email: string;
  displayName?: string;
  partstat?: "NEEDS-ACTION" | "ACCEPTED" | "DECLINED" | "TENTATIVE";
  role?: string;
};

export type IcsEvent = {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  startsAt: number;
  endsAt: number;
  allDay?: boolean;
  sequence?: number;
  organizerEmail?: string;
  organizerName?: string;
  attendees?: IcsAttendee[];
  status?: string;
};

export type IcsMethod = "REQUEST" | "REPLY" | "CANCEL" | "PUBLISH";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** UTC stamp: 20260108T123000Z */
export function icsUtc(ms: number): string {
  const d = new Date(ms);
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export function foldIcsLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length) {
    parts.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  return parts.join("\r\n");
}

function attendeeLine(a: IcsAttendee): string {
  const params = [
    `CUTYPE=INDIVIDUAL`,
    `ROLE=${a.role || "REQ-PARTICIPANT"}`,
    `PARTSTAT=${a.partstat || "NEEDS-ACTION"}`,
    `RSVP=TRUE`,
  ];
  if (a.displayName) params.push(`CN=${escapeIcsText(a.displayName)}`);
  return `ATTENDEE;${params.join(";")}:mailto:${a.email}`;
}

export function buildIcs(event: IcsEvent, method: IcsMethod = "REQUEST"): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Flap//Calendar//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${icsUtc(Date.now())}`,
    `DTSTART:${icsUtc(event.startsAt)}`,
    `DTEND:${icsUtc(event.endsAt)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `SEQUENCE:${Math.max(0, event.sequence ?? 0)}`,
    `STATUS:${(event.status || "CONFIRMED").toUpperCase()}`,
  ];
  if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  if (event.organizerEmail) {
    const cn = event.organizerName ? `;CN=${escapeIcsText(event.organizerName)}` : "";
    lines.push(`ORGANIZER${cn}:mailto:${event.organizerEmail}`);
  }
  for (const a of event.attendees || []) {
    if (a.email) lines.push(attendeeLine(a));
  }
  lines.push("END:VEVENT", "END:VCALENDAR", "");
  return lines.map(foldIcsLine).join("\r\n");
}

function unfold(ics: string): string[] {
  const raw = ics.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const lines: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length) {
      lines[lines.length - 1] += line.slice(1);
    } else if (line.trim()) {
      lines.push(line);
    }
  }
  return lines;
}

function parseUtc(value: string): number | null {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/.exec(value.trim());
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}

function mailto(value: string): string {
  return value.replace(/^mailto:/i, "").trim().toLowerCase();
}

export type ParsedIcs = {
  method: IcsMethod | string;
  uid: string;
  title: string;
  description: string;
  location: string;
  startsAt: number;
  endsAt: number;
  sequence: number;
  organizerEmail: string;
  attendees: IcsAttendee[];
};

export function parseIcs(ics: string): ParsedIcs | null {
  const lines = unfold(ics);
  let method: string = "PUBLISH";
  let uid = "";
  let title = "";
  let description = "";
  let location = "";
  let startsAt = 0;
  let endsAt = 0;
  let sequence = 0;
  let organizerEmail = "";
  const attendees: IcsAttendee[] = [];
  let inEvent = false;

  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const left = line.slice(0, idx);
    const value = line.slice(idx + 1);
    const name = left.split(";")[0].toUpperCase();
    const params = left.includes(";") ? left.slice(left.indexOf(";") + 1) : "";

    if (name === "METHOD") method = value.toUpperCase();
    if (name === "BEGIN" && value === "VEVENT") inEvent = true;
    if (name === "END" && value === "VEVENT") inEvent = false;
    if (!inEvent && name !== "METHOD") continue;

    if (name === "UID") uid = value.trim();
    if (name === "SUMMARY") title = value.replace(/\\n/g, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";");
    if (name === "DESCRIPTION") description = value.replace(/\\n/g, "\n").replace(/\\,/g, ",");
    if (name === "LOCATION") location = value.replace(/\\n/g, "\n");
    if (name === "SEQUENCE") sequence = Number(value) || 0;
    if (name === "DTSTART") startsAt = parseUtc(value) || startsAt;
    if (name === "DTEND") endsAt = parseUtc(value) || endsAt;
    if (name === "ORGANIZER") organizerEmail = mailto(value);
    if (name === "ATTENDEE") {
      const partstatMatch = /PARTSTAT=([A-Z-]+)/i.exec(params);
      const cnMatch = /CN=([^;]+)/i.exec(params);
      attendees.push({
        email: mailto(value),
        displayName: cnMatch?.[1]?.replace(/\\,/g, ",") || undefined,
        partstat: (partstatMatch?.[1]?.toUpperCase() as IcsAttendee["partstat"]) || "NEEDS-ACTION",
      });
    }
  }

  if (!uid || !startsAt || !endsAt) return null;
  return {
    method,
    uid,
    title: title || "(no subject)",
    description,
    location,
    startsAt,
    endsAt,
    sequence,
    organizerEmail,
    attendees,
  };
}

export function icsToBase64DataUrl(ics: string): string {
  const bytes = new TextEncoder().encode(ics);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const b64 = btoa(binary);
  return `data:text/calendar;base64,${b64}`;
}
