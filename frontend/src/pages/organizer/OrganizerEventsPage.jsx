import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, Plus, Ticket, Coins, Pencil } from "lucide-react";
import { api } from "@/lib/api";
import { formatEventDate, isPastEvent } from "@/lib/format";

const STATUS_STYLES = {
  draft: { label: "DRAFT", cls: "bg-canvas text-foreground/60 border-foreground" },
  published: { label: "PUBLISHED", cls: "bg-gigs-teal text-ink border-foreground" },
  suspended: { label: "SUSPENDED", cls: "bg-gigs-yellow text-ink border-foreground" },
  cancelled: { label: "CANCELLED", cls: "bg-error text-background border-foreground" },
};

const statusBadge = (status) => {
  const s = STATUS_STYLES[status] || { label: status, cls: "bg-canvas text-ink border-foreground" };
  return (
    <span className={`inline-flex items-center rounded-none px-2 py-1 text-xs font-black uppercase tracking-widest brut-border-2 ${s.cls}`}>
      {s.label}
    </span>
  );
};

export default function OrganizerEventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    return api.get("/events/mine");
  }, []);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => {
        if (cancelled) return;
        setEvents(data.events || []);
        setError("");
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load events");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const publish = async (id) => {
    setError("");
    try {
      await api.put(`/events/${id}/publish`);
      setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, status: "published" } : e)));
    } catch (err) {
      setError(err.message || "Publish failed");
    }
  };

  const cancel = async (id, title) => {
    setError("");
    if (!window.confirm(`Cancel "${title}"? Ticket holders will be refunded. This cannot be undone.`)) {
      return;
    }
    try {
      await api.put(`/events/${id}/cancel`);
      setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, status: "cancelled" } : e)));
    } catch (err) {
      setError(err.message || "Cancel failed");
    }
  };

  if (loading) {
    return (
      <section className="py-20 flex justify-center">
        <div className="w-40 h-40 border-4 border-foreground bg-gigs-purple animate-pulse brut-shadow" />
      </section>
    );
  }

  return (
    <section className="py-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
        <div>
          <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-2 flex items-center gap-4">
            MY <span className="bg-foreground text-background px-2 brut-shadow -rotate-2 inline-block">EVENTS</span>
          </h1>
          <p className="font-bold text-lg">Build it, publish it, pack the venue.</p>
        </div>
        <Link
          to="/organizer/events/new"
          data-testid="organizer-new-event-link"
          className="inline-flex items-center gap-2 bg-gigs-pink text-foreground px-6 py-3 font-black uppercase brut-border-2 brut-shadow brut-button"
        >
          <Plus size={20} strokeWidth={3} /> New Event
        </Link>
      </div>

      {error && (
        <p className="border-2 border-error bg-error/10 text-error font-bold px-4 py-3 uppercase text-sm mb-6">
          {error}
        </p>
      )}

      {events.length === 0 ? (
        <div className="border-4 border-foreground bg-canvas p-12 text-center">
          <Calendar size={48} strokeWidth={3} className="mx-auto mb-4 text-gigs-pink" />
          <h2 className="text-3xl font-black uppercase tracking-tighter mb-2">no events yet</h2>
          <p className="font-bold">Your first gig starts with a big idea. Get it on the calendar. <span className="text-gigs-pink">✸</span></p>
          <Link to="/organizer/events/new" className="mt-8 inline-block bg-gigs-pink text-foreground px-6 py-3 font-black uppercase brut-border-2 brut-button">
            CREATE EVENT →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col">
          <div className="hidden md:grid grid-cols-12 gap-4 py-4 border-b-4 border-foreground text-sm font-bold uppercase tracking-widest">
            <div className="col-span-4">EVENT</div>
            <div className="col-span-2">STATUS</div>
            <div className="col-span-6 text-right">ACTIONS</div>
          </div>

          {events.map((event) => (
            <div key={event.id} className="group grid grid-cols-1 md:grid-cols-12 gap-4 py-6 border-b-2 border-foreground/30 items-center hover:bg-surface-card transition-colors">
              <div className="col-span-1 md:col-span-4">
                <Link to={`/events/${event.id}`} className="group-hover:text-gigs-pink transition-colors">
                  <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tight leading-tight">
                    {event.title}
                  </h3>
                </Link>
                <p className="text-sm font-bold text-foreground/70 mt-1 flex items-center gap-2">
                  <Calendar size={14} /> {formatEventDate(event.event_date)}
                </p>
              </div>
              <div className="col-span-1 md:col-span-2">{statusBadge(event.status)}</div>
              <div className="col-span-1 md:col-span-6 flex flex-wrap gap-3 md:justify-end">
                {event.status === "draft" && (
                  <button
                    type="button"
                    data-testid={`event-publish-${event.id}`}
                    onClick={() => publish(event.id)}
                    className="inline-flex items-center gap-2 bg-gigs-teal text-ink px-4 py-2 font-black uppercase text-sm brut-border-2 brut-button"
                  >
                    Publish
                  </button>
                )}
                {(event.status === "published" || event.status === "suspended") && !isPastEvent(event.event_date) && (
                  <button
                    type="button"
                    data-testid={`event-cancel-${event.id}`}
                    onClick={() => cancel(event.id, event.title)}
                    className="inline-flex items-center gap-2 bg-error text-background px-4 py-2 font-black uppercase text-sm brut-border-2 brut-button"
                  >
                    Cancel
                  </button>
                )}
                <Link
                  to={`/organizer/events/${event.id}/edit`}
                  className="inline-flex items-center gap-2 bg-canvas text-ink px-4 py-2 font-black uppercase text-sm brut-border-2 brut-button"
                >
                  <Pencil size={16} /> Edit
                </Link>
                <Link
                  to={`/organizer/events/${event.id}/categories`}
                  className="inline-flex items-center gap-2 bg-canvas text-ink px-4 py-2 font-black uppercase text-sm brut-border-2 brut-button"
                >
                  <Ticket size={16} /> Tickets
                </Link>
                <Link
                  to={`/organizer/events/${event.id}/orders`}
                  className="inline-flex items-center gap-2 bg-gigs-purple text-ink px-4 py-2 font-black uppercase text-sm brut-border-2 brut-button"
                >
                  <Coins size={16} /> Orders
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}