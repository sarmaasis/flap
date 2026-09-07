import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Copy, Download, KeyRound, Plus, Trash2 } from "lucide-react";
import AppFeaturePage from "../components/AppFeaturePage";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { api, type CalendarAppToken, type CalendarEvent } from "../lib/api";
import { go } from "../lib/nav";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const escapeIcs = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function endOfDay(d: Date) {
  return startOfDay(d) + 86400000;
}

function eventOverlapsDay(event: CalendarEvent, day: Date) {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);
  return event.starts_at < dayEnd && event.ends_at > dayStart;
}

function eventTopPx(event: CalendarEvent, day: Date) {
  const dayStart = startOfDay(day);
  const start = Math.max(event.starts_at, dayStart);
  const minutes = (start - dayStart) / 60000;
  return (minutes / 60) * 48;
}

function eventHeightPx(event: CalendarEvent, day: Date) {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);
  const start = Math.max(event.starts_at, dayStart);
  const end = Math.min(event.ends_at, dayEnd);
  const minutes = Math.max(15, (end - start) / 60000);
  return (minutes / 60) * 48;
}

function downloadIcs(event: CalendarEvent) {
  const content = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Flap//Calendar//EN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid || `${event.id}@flap`}`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(new Date(event.starts_at))}`,
    `DTEND:${icsDate(new Date(event.ends_at))}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    event.description ? `DESCRIPTION:${escapeIcs(event.description)}` : "",
    event.location ? `LOCATION:${escapeIcs(event.location)}` : "",
    ...(event.attendees || []).map(
      (a) =>
        `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=${a.partstat || "NEEDS-ACTION"}:mailto:${a.email}`,
    ),
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ]
    .filter(Boolean)
    .join("\r\n");
  const url = URL.createObjectURL(new Blob([content], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${event.title.replace(/[^\w.-]+/g, "-").slice(0, 40) || "flap-event"}.ics`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function parseAttendeeEmails(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[,;\n]+/)
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.includes("@")),
    ),
  ];
}

export default function CalendarAppPage() {
  const [view, setView] = useState<"week" | "month" | "day">("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(dateKey(new Date()));
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState("30");
  const [attendees, setAttendees] = useState("");
  const [sendInvites, setSendInvites] = useState(true);
  const [syncOpen, setSyncOpen] = useState(false);
  const [tokens, setTokens] = useState<CalendarAppToken[]>([]);
  const [caldavUrl, setCaldavUrl] = useState("");
  const [freshToken, setFreshToken] = useState("");
  const [tokenBusy, setTokenBusy] = useState(false);
  const today = new Date();

  const days = useMemo(() => {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), view === "month" ? 1 : anchor.getDate());
    if (view !== "day") first.setDate(first.getDate() - ((first.getDay() + 6) % 7));
    return Array.from({ length: view === "month" ? 42 : view === "week" ? 7 : 1 }, (_, i) => {
      const d = new Date(first);
      d.setDate(first.getDate() + i);
      return d;
    });
  }, [anchor, view]);

  const range = useMemo(() => {
    if (!days.length) {
      const now = Date.now();
      return { from: now - 7 * 86400000, to: now + 40 * 86400000 };
    }
    return {
      from: startOfDay(days[0]) - 86400000,
      to: endOfDay(days[days.length - 1]) + 86400000,
    };
  }, [days]);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.calendarEvents(range.from, range.to);
      setEvents(res.events || []);
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Could not load calendar events.");
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  async function loadTokens() {
    try {
      const res = await api.calendarTokens();
      setTokens(res.tokens || []);
      setCaldavUrl(res.caldav_url || "");
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Could not load CalDAV settings.");
    }
  }

  function move(direction: number) {
    const next = new Date(anchor);
    if (view === "month") {
      next.setDate(1);
      next.setMonth(next.getMonth() + direction);
    } else next.setDate(next.getDate() + direction * (view === "week" ? 7 : 1));
    setAnchor(next);
  }

  function openCreate(forDate?: string, forTime?: string) {
    setSelected(null);
    setTitle("");
    setDate(forDate || dateKey(anchor));
    setTime(forTime || "09:00");
    setDuration("30");
    setAttendees("");
    setSendInvites(true);
    setOpen(true);
  }

  function openEdit(event: CalendarEvent) {
    const start = new Date(event.starts_at);
    setSelected(event);
    setTitle(event.title);
    setDate(dateKey(start));
    setTime(`${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`);
    setDuration(String(Math.max(5, Math.round((event.ends_at - event.starts_at) / 60000))));
    setAttendees((event.attendees || []).map((a) => a.email).join(", "));
    setSendInvites(Boolean(event.attendees?.length));
    setOpen(true);
  }

  async function saveEvent(e: React.FormEvent) {
    e.preventDefault();
    const start = new Date(`${date}T${time}`);
    if (!title.trim() || !Number.isFinite(start.getTime())) return;
    const endsAt = start.getTime() + Number(duration) * 60000;
    const guestList = parseAttendeeEmails(attendees);
    setSaving(true);
    setError("");
    try {
      const payload = {
        title: title.trim(),
        starts_at: start.getTime(),
        ends_at: endsAt,
        attendees: guestList,
        send_invites: sendInvites && guestList.length > 0,
      };
      if (selected) {
        const res = await api.updateCalendarEvent(selected.id, payload);
        setEvents((prev) => prev.map((ev) => (ev.id === selected.id ? res.event : ev)));
        setNotice(
          res.invite_sent
            ? `Event updated. Invitations sent to ${res.invite_sent}.`
            : res.invite_error
              ? `Event updated, but invites failed: ${res.invite_error}`
              : "Event updated.",
        );
      } else {
        const res = await api.createCalendarEvent(payload);
        setEvents((prev) => [...prev, res.event].sort((a, b) => a.starts_at - b.starts_at));
        setNotice(
          res.invite_sent
            ? `Event saved. Invitations sent to ${res.invite_sent}.`
            : res.invite_error
              ? `Event saved, but invites failed: ${res.invite_error}`
              : "Event saved to Flap.",
        );
      }
      setOpen(false);
      setSelected(null);
      setTitle("");
      setAttendees("");
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Could not save event.");
    } finally {
      setSaving(false);
    }
  }

  async function removeEvent() {
    if (!selected) return;
    const hasGuests = Boolean(selected.attendees?.length);
    const notify = hasGuests && window.confirm("Notify attendees that this event is cancelled?");
    if (!hasGuests && !window.confirm(`Delete “${selected.title}”?`)) return;
    if (hasGuests && !notify && !window.confirm(`Delete “${selected.title}” without notifying guests?`)) return;
    setSaving(true);
    try {
      await api.deleteCalendarEvent(selected.id, notify);
      setEvents((prev) => prev.filter((ev) => ev.id !== selected.id));
      setOpen(false);
      setSelected(null);
      setNotice(notify ? "Event cancelled and guests notified." : "Event deleted.");
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Could not delete event.");
    } finally {
      setSaving(false);
    }
  }

  async function createToken() {
    setTokenBusy(true);
    setError("");
    try {
      const res = await api.createCalendarToken("CalDAV");
      setFreshToken(res.token.token);
      setCaldavUrl(res.caldav_url);
      await loadTokens();
      setNotice("CalDAV app password created. Copy it now — it is shown only once.");
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Could not create CalDAV password.");
    } finally {
      setTokenBusy(false);
    }
  }

  async function revokeToken(id: string) {
    if (!window.confirm("Revoke this CalDAV app password?")) return;
    setTokenBusy(true);
    try {
      await api.deleteCalendarToken(id);
      if (freshToken) setFreshToken("");
      await loadTokens();
      setNotice("CalDAV app password revoked.");
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Could not revoke password.");
    } finally {
      setTokenBusy(false);
    }
  }

  const dayEvents = (day: Date) => events.filter((ev) => eventOverlapsDay(ev, day));

  return (
    <AppFeaturePage
      current="calendar"
      title={anchor.toLocaleString(undefined, { month: "long", year: "numeric" })}
      subtitle="Save events, send invitations, and sync with CalDAV (Solo+)."
      actions={
        <>
          <Button variant="ghost" size="icon" aria-label={`Previous ${view}`} onClick={() => move(-1)}>
            <ChevronLeft />
          </Button>
          <Button variant="outline" onClick={() => setAnchor(new Date())}>
            Today
          </Button>
          <Button variant="ghost" size="icon" aria-label={`Next ${view}`} onClick={() => move(1)}>
            <ChevronRight />
          </Button>
          <div className="seg-toggle">
            {(["week", "month", "day"] as const).map((v) => (
              <button key={v} type="button" aria-pressed={view === v} className={view === v ? "active" : ""} onClick={() => setView(v)}>
                {v}
              </button>
            ))}
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              setSyncOpen(true);
              void loadTokens();
            }}
          >
            <KeyRound className="h-4 w-4" />
            CalDAV
          </Button>
          <Button variant="secondary" onClick={() => go("/app/bookings")}>
            Booking pages
          </Button>
          <Button onClick={() => openCreate()}>
            <Plus className="h-4 w-4" />
            New event
          </Button>
        </>
      }
    >
      {notice ? (
        <p className="notice mb-4" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="error mb-4" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p className="muted mb-3 text-sm">Loading events…</p> : null}

      {view === "month" ? (
        <div className="cal-month-wrap">
          <div className="cal-month">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div className="cal-month-label" key={d}>
                {d}
              </div>
            ))}
            {days.map((d) => {
              const items = dayEvents(d).slice(0, 3);
              return (
                <button
                  key={dateKey(d)}
                  type="button"
                  className={`cal-month-day ${d.getMonth() !== anchor.getMonth() ? "outside" : ""}`}
                  aria-label={`View ${d.toLocaleDateString()}`}
                  onClick={() => {
                    setAnchor(d);
                    setView("day");
                  }}
                >
                  <span className={dateKey(d) === dateKey(today) ? "cal-today-num" : ""}>{d.getDate()}</span>
                  <div className="cal-month-events">
                    {items.map((ev) => (
                      <span key={ev.id} className="cal-month-chip" title={ev.title}>
                        {ev.title}
                      </span>
                    ))}
                    {dayEvents(d).length > 3 ? (
                      <span className="cal-month-more">+{dayEvents(d).length - 3}</span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className={`cal-week ${view === "day" ? "cal-single-day" : ""}`}>
          <div className="cal-week-head">
            <div className="cal-gutter" />
            {days.map((d) => (
              <div key={dateKey(d)} className="cal-day-head">
                <span>{d.toLocaleDateString(undefined, { weekday: "short" })}</span>
                <strong className={dateKey(d) === dateKey(today) ? "cal-today-num" : ""}>{d.getDate()}</strong>
              </div>
            ))}
          </div>
          <div className="cal-week-grid">
            <div className="cal-hours">
              {HOURS.map((h) => (
                <div key={h} className="cal-hour">
                  {`${h % 12 || 12} ${h >= 12 ? "PM" : "AM"}`}
                </div>
              ))}
            </div>
            {days.map((d) => (
              <div key={dateKey(d)} className="cal-day-col">
                {HOURS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    className="cal-slot"
                    aria-label={`Create event on ${d.toLocaleDateString()} at ${h}:00`}
                    onClick={() => openCreate(dateKey(d), `${String(h).padStart(2, "0")}:00`)}
                  />
                ))}
                {dayEvents(d).map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    className="cal-event-block"
                    style={{ top: eventTopPx(ev, d), height: eventHeightPx(ev, d) }}
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(ev);
                    }}
                    title={ev.title}
                  >
                    <strong>{ev.title}</strong>
                    <span>
                      {new Date(ev.starts_at).toLocaleTimeString(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected ? "Edit event" : "New event"}</DialogTitle>
            <DialogDescription>
              Save to Flap and optionally email .ics invitations (Solo+). Guests can Accept / Decline from their inbox.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void saveEvent(e)} className="stack gap-3">
            <label>
              Event title
              <Input autoFocus required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Project catch-up" />
            </label>
            <div className="grid-2">
              <label>
                Date
                <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              <label>
                Time
                <Input type="time" required value={time} onChange={(e) => setTime(e.target.value)} />
              </label>
            </div>
            <label>
              Duration in minutes
              <Input type="number" min="5" max="1440" required value={duration} onChange={(e) => setDuration(e.target.value)} />
            </label>
            <label>
              Invite guests
              <Input
                value={attendees}
                onChange={(e) => setAttendees(e.target.value)}
                placeholder="alex@startup.com, jordan@client.com"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={sendInvites} onChange={(e) => setSendInvites(e.target.checked)} />
              Email invitations when guests are listed
            </label>
            {selected?.attendees?.length ? (
              <ul className="muted text-sm" style={{ margin: 0, paddingLeft: "1.1rem" }}>
                {selected.attendees.map((a) => (
                  <li key={a.email}>
                    {a.email} · {(a.partstat || "NEEDS-ACTION").toLowerCase().replace("-", " ")}
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="muted text-sm">Times use your device’s time zone.</p>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : selected ? "Save changes" : sendInvites && parseAttendeeEmails(attendees).length ? "Save & send invites" : "Save event"}
              </Button>
              {selected ? (
                <>
                  <Button type="button" variant="secondary" onClick={() => downloadIcs(selected)}>
                    <Download className="h-4 w-4" />
                    Download .ics
                  </Button>
                  <Button type="button" variant="danger" onClick={() => void removeEvent()} disabled={saving}>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </>
              ) : null}
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={syncOpen} onOpenChange={setSyncOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>CalDAV sync</DialogTitle>
            <DialogDescription>
              Connect Apple Calendar, Thunderbird, or other CalDAV clients with an app password (Solo+).
            </DialogDescription>
          </DialogHeader>
          <div className="stack gap-3">
            {caldavUrl ? (
              <label>
                Server URL
                <div className="flex gap-2">
                  <Input readOnly value={caldavUrl} />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    aria-label="Copy CalDAV URL"
                    onClick={() => void navigator.clipboard.writeText(caldavUrl)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </label>
            ) : null}
            <p className="muted text-sm">Username: any mailbox address on this workspace. Password: the app password below.</p>
            {freshToken ? (
              <label>
                New app password (copy now)
                <div className="flex gap-2">
                  <Input readOnly value={freshToken} />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    aria-label="Copy app password"
                    onClick={() => void navigator.clipboard.writeText(freshToken)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </label>
            ) : null}
            <Button type="button" onClick={() => void createToken()} disabled={tokenBusy}>
              {tokenBusy ? "Working…" : "Create app password"}
            </Button>
            {tokens.length ? (
              <ul className="stack gap-2" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {tokens.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>
                      {t.label} · {t.token_prefix}…
                    </span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => void revokeToken(t.id)} disabled={tokenBusy}>
                      Revoke
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted text-sm">No app passwords yet.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppFeaturePage>
  );
}
