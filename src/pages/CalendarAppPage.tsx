import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import AppFeaturePage from "../components/AppFeaturePage";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { go } from "../lib/nav";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const escapeIcs = (s: string) => s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

export default function CalendarAppPage() {
  const [view, setView] = useState<"week" | "month" | "day">("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(dateKey(new Date()));
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState("30");
  const [notice, setNotice] = useState("");
  const today = new Date();
  const days = useMemo(() => {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), view === "month" ? 1 : anchor.getDate());
    if (view !== "day") first.setDate(first.getDate() - (first.getDay() + 6) % 7);
    return Array.from({ length: view === "month" ? 42 : view === "week" ? 7 : 1 }, (_, i) => {
      const d = new Date(first); d.setDate(first.getDate() + i); return d;
    });
  }, [anchor, view]);
  function move(direction: number) {
    const next = new Date(anchor);
    if (view === "month") { next.setDate(1); next.setMonth(next.getMonth() + direction); }
    else next.setDate(next.getDate() + direction * (view === "week" ? 7 : 1));
    setAnchor(next);
  }
  function downloadEvent(e: React.FormEvent) {
    e.preventDefault();
    const start = new Date(`${date}T${time}`);
    if (!title.trim() || !Number.isFinite(start.getTime())) return;
    const end = new Date(start.getTime() + Number(duration) * 60000);
    const content = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Flap//Calendar//EN", "BEGIN:VEVENT", `UID:${crypto.randomUUID()}@flap`, `DTSTAMP:${icsDate(new Date())}`, `DTSTART:${icsDate(start)}`, `DTEND:${icsDate(end)}`, `SUMMARY:${escapeIcs(title.trim())}`, "END:VEVENT", "END:VCALENDAR", ""].join("\r\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "flap-event.ics"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setOpen(false); setTitle(""); setNotice("Event downloaded. Open the file in your calendar app to save it. Invitations have not been sent.");
  }
  return <AppFeaturePage current="calendar" title={anchor.toLocaleString(undefined, { month: "long", year: "numeric" })}
    subtitle="Plan your week and create calendar files. Connected events and live availability sync are not yet available."
    actions={<><Button variant="ghost" size="icon" aria-label={`Previous ${view}`} onClick={() => move(-1)}><ChevronLeft /></Button><Button variant="outline" onClick={() => setAnchor(new Date())}>Today</Button><Button variant="ghost" size="icon" aria-label={`Next ${view}`} onClick={() => move(1)}><ChevronRight /></Button><div className="seg-toggle">{(["week", "month", "day"] as const).map(v => <button key={v} aria-pressed={view === v} className={view === v ? "active" : ""} onClick={() => setView(v)}>{v}</button>)}</div><Button variant="secondary" onClick={() => go("/app/bookings")}>Booking pages</Button><Button onClick={() => { setDate(dateKey(anchor)); setOpen(true); }}>Create event file</Button></>}>
    {notice && <p className="notice mb-4" role="status">{notice}</p>}
    {view === "month" ? <div className="cal-month-wrap"><div className="cal-month">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => <div className="cal-month-label" key={d}>{d}</div>)}{days.map(d => <button key={dateKey(d)} className={`cal-month-day ${d.getMonth() !== anchor.getMonth() ? "outside" : ""}`} aria-label={`View ${d.toLocaleDateString()}`} onClick={() => { setAnchor(d); setView("day"); }}><span className={dateKey(d) === dateKey(today) ? "cal-today-num" : ""}>{d.getDate()}</span></button>)}</div></div> :
    <div className={`cal-week ${view === "day" ? "cal-single-day" : ""}`}><div className="cal-week-head"><div className="cal-gutter" />{days.map(d => <div key={dateKey(d)} className="cal-day-head"><span>{d.toLocaleDateString(undefined, { weekday: "short" })}</span><strong className={dateKey(d) === dateKey(today) ? "cal-today-num" : ""}>{d.getDate()}</strong></div>)}</div><div className="cal-week-grid"><div className="cal-hours">{HOURS.map(h => <div key={h} className="cal-hour">{`${h % 12 || 12} ${h >= 12 ? "PM" : "AM"}`}</div>)}</div>{days.map(d => <div key={dateKey(d)} className="cal-day-col">{HOURS.map(h => <button key={h} className="cal-slot" aria-label={`Create event on ${d.toLocaleDateString()} at ${h}:00`} onClick={() => { setDate(dateKey(d)); setTime(`${String(h).padStart(2, "0")}:00`); setOpen(true); }} />)}</div>)}</div></div>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Create a calendar event</DialogTitle><DialogDescription>Download an event to open in Apple Calendar, Google Calendar, or Outlook. This does not save an event to Flap or send invitations.</DialogDescription></DialogHeader><form onSubmit={downloadEvent} className="stack gap-3"><label>Event title<Input autoFocus required value={title} onChange={e => setTitle(e.target.value)} placeholder="Project catch-up" /></label><div className="grid-2"><label>Date<Input type="date" required value={date} onChange={e => setDate(e.target.value)} /></label><label>Time<Input type="time" required value={time} onChange={e => setTime(e.target.value)} /></label></div><label>Duration in minutes<Input type="number" min="5" max="1440" required value={duration} onChange={e => setDuration(e.target.value)} /></label><p className="muted text-sm">Times use your device’s time zone.</p><Button type="submit"><Download /> Download event</Button></form></DialogContent></Dialog>
  </AppFeaturePage>;
}
