import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, AlertCircle, Pencil } from "lucide-react";
import { api } from "@/lib/api";
import { formatEventDate } from "@/lib/format";

const STATUS_STYLES = {
  draft: { label: "DRAFT", cls: "bg-canvas text-foreground border-foreground" },
  published: { label: "PUBLISHED", cls: "bg-gigs-teal text-ink border-foreground" },
  suspended: { label: "SUSPENDED", cls: "bg-gigs-orange text-ink border-foreground" },
  cancelled: { label: "CANCELLED", cls: "bg-error text-background border-foreground" },
};

const statusBadge = (status) => {
  const s = STATUS_STYLES[status] || { label: status, cls: "bg-canvas text-ink border-foreground" };
  return (
    <span className={`inline-flex items-center rounded-none px-2 py-1 font-black uppercase tracking-widest text-xs brut-border-2 ${s.cls}`}>
      {s.label}
    </span>
  );
};

export default function AdminEventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    return api.get("/admin/events");
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

  const refresh = useCallback(async () => {
    try {
      const data = await load();
      setEvents(data.events || []);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load events");
    }
  }, [load]);

  const suspend = async (id) => {
    setError("");
    try {
      await api.put(`/events/${id}/suspend`);
      await refresh();
    } catch (err) {
      setError(err.message || "Suspend failed");
    }
  };

  const unsuspend = async (id) => {
    setError("");
    try {
      await api.put(`/events/${id}/unsuspend`);
      await refresh();
    } catch (err) {
      setError(err.message || "Unsuspend failed");
    }
  };

  const cancel = async (id) => {
    setError("");
    try {
      await api.put(`/events/${id}/cancel`);
      await refresh();
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
      <div className="mb-10">
        <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-2 flex items-center gap-4">
          EVENT <span className="bg-foreground text-background px-2 brut-shadow -rotate-2 inline-block">CONTROL</span>
        </h1>
        <p className="font-bold text-lg">Manage all events on the platform.</p>
      </div>

      {error && (
        <div className="gigs-card bg-error text-background mb-8">
          <p className="font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b-4 border-foreground">
              <th className="py-3 px-3 text-xs font-black uppercase tracking-widest whitespace-nowrap">Title</th>
              <th className="py-3 px-3 text-xs font-black uppercase tracking-widest whitespace-nowrap">Organizer</th>
              <th className="py-3 px-3 text-xs font-black uppercase tracking-widest whitespace-nowrap">Date</th>
              <th className="py-3 px-3 text-xs font-black uppercase tracking-widest whitespace-nowrap">Status</th>
              <th className="py-3 px-3 text-xs font-black uppercase tracking-widest whitespace-nowrap text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 && (
              <tr>
                <td colSpan={5} className="py-16 text-center text-sm text-foreground opacity-50 font-bold uppercase">
                  No events found
                </td>
              </tr>
            )}
            {events.map((event) => (
              <tr
                key={event.id}
                className="border-b border-foreground hover:bg-gigs-ochre/20 transition-colors"
              >
                <td className="py-3 px-3 whitespace-nowrap">
                  <Link to={`/events/${event.id}`} className="font-bold text-sm text-foreground hover:text-gigs-pink transition-colors">
                    {event.title || "—"}
                  </Link>
                </td>
                <td className="py-3 px-3 whitespace-nowrap text-sm font-bold text-foreground/70">
                  {event.organizer_name || event.organizer_email || "—"}
                </td>
                <td className="py-3 px-3 whitespace-nowrap text-sm font-bold text-foreground/70">
                  <span className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {formatEventDate(event.event_date)}
                  </span>
                </td>
                <td className="py-3 px-3 whitespace-nowrap">{statusBadge(event.status)}</td>
                <td className="py-3 px-3 whitespace-nowrap text-right">
                  <div className="inline-flex flex-wrap gap-2 justify-end">
                    {event.status === "published" && (
                      <button
                        type="button"
                        data-testid={`admin-suspend-${event.id}`}
                        onClick={() => suspend(event.id)}
                        className="inline-flex items-center gap-1 bg-gigs-orange text-ink px-3 py-1 font-black uppercase text-xs brut-border-2 brut-button"
                      >
                        Suspend
                      </button>
                    )}
                    {event.status === "suspended" && (
                      <button
                        type="button"
                        data-testid={`admin-unsuspend-${event.id}`}
                        onClick={() => unsuspend(event.id)}
                        className="inline-flex items-center gap-1 bg-gigs-teal text-ink px-3 py-1 font-black uppercase text-xs brut-border-2 brut-button"
                      >
                        Unsuspend
                      </button>
                    )}
                    {(event.status === "published" || event.status === "suspended") && (
                      <button
                        type="button"
                        data-testid={`admin-cancel-${event.id}`}
                        onClick={() => cancel(event.id)}
                        className="inline-flex items-center gap-1 bg-error text-background px-3 py-1 font-black uppercase text-xs brut-border-2 brut-button"
                      >
                        Cancel
                      </button>
                    )}
                    <Link
                      to={`/organizer/events/${event.id}/edit`}
                      className="inline-flex items-center gap-1 bg-canvas text-ink px-3 py-1 font-black uppercase text-xs brut-border-2 brut-button"
                    >
                      <Pencil size={14} /> Edit
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
