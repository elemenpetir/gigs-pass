import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Calendar } from "lucide-react";
import { api } from "@/lib/api";
import { formatEventDate, formatCompact } from "@/lib/format";
import { EVENT_CATEGORIES, categoryLabel } from "@/lib/categories";

function EventCard({ event, minPrice }) {
  return (
    <Link
      to={`/events/${event.id}`}
      className="group bg-background brut-border-4 p-4 brut-shadow brut-card-hover flex flex-col h-full relative"
    >
      <div className="absolute -top-3 -right-3 bg-gigs-purple px-2 py-1 brut-border-2 font-black text-xs uppercase z-10 group-hover:scale-110 transition-transform">
        {categoryLabel(event.category)}
      </div>
      <div className="aspect-4/3 brut-border-2 overflow-hidden relative bg-gigs-dark">
        {event.image_url ? (
          <img
            src={event.image_url}
            alt={event.title}
            className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-background/80 font-black uppercase text-2xl tracking-tighter text-center p-4">
            {event.title.slice(0, 12)}
          </div>
        )}
      </div>
      <div className="flex-1 flex flex-col mt-4">
        <h3 className="text-2xl font-black uppercase leading-tight mb-2 group-hover:text-gigs-pink transition-colors">
          {event.title}
        </h3>
        <div className="flex items-center gap-2 text-sm font-bold">
          <Calendar size={16} /> {formatEventDate(event.event_date)}
        </div>
        <div className="mt-auto pt-4 border-t-2 border-dashed border-foreground/30 flex justify-between items-end">
          <div>
            <span className="text-xs font-bold uppercase text-gray-500 block mb-1">FROM</span>
            <span className="text-xl font-black">{minPrice !== null ? formatCompact(minPrice) : "TBA"}</span>
          </div>
          <ArrowRight size={24} strokeWidth={3} className="group-hover:translate-x-2 transition-transform" />
        </div>
      </div>
    </Link>
  );
}

export default function EventsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCategory = searchParams.get("category") || "";
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get("/events");
        const list = data.events || [];
        if (cancelled) return;
        setEvents(list);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load events");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const selectCategory = (slug) => {
    if (slug) {
      setSearchParams({ category: slug });
    } else {
      setSearchParams({});
    }
  };

  const filtered = activeCategory
    ? events.filter((e) => e.category === activeCategory)
    : events;

  return (
    <section className="py-8 md:py-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-4">
        <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter">
          EVENTS <span className="bg-gigs-pink px-2 brut-shadow -rotate-2 inline-block">EXPLORER</span>
        </h1>
        <p className="font-bold uppercase text-sm md:text-base">All the gigs. One grid.</p>
      </div>

      <div className="flex flex-wrap gap-3 mb-10">
        <button
          onClick={() => selectCategory("")}
          className={`font-black uppercase text-sm px-4 py-2 brut-border-2 transition-colors ${
            activeCategory === "" ? "bg-foreground text-background" : "bg-background hover:bg-gigs-yellow"
          }`}
        >
          ALL
        </button>
        {EVENT_CATEGORIES.map((c) => (
          <button
            key={c.slug}
            onClick={() => selectCategory(c.slug)}
            className={`font-black uppercase text-sm px-4 py-2 brut-border-2 transition-colors ${
              activeCategory === c.slug
                ? "bg-foreground text-background"
                : "bg-background hover:bg-gigs-yellow"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-24 flex justify-center">
          <div className="w-40 h-40 border-4 border-foreground bg-gigs-purple animate-pulse brut-shadow" />
        </div>
      ) : error ? (
        <div className="border-4 border-foreground bg-canvas p-12 text-center">
          <h3 className="text-3xl font-black uppercase tracking-tighter mb-2">something went wrong</h3>
          <p className="border-2 border-error bg-error/10 text-error font-bold px-4 py-3 uppercase text-sm inline-block">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="border-4 border-foreground bg-canvas p-12 text-center">
          <h3 className="text-3xl font-black uppercase tracking-tighter mb-2">no events here</h3>
          <p className="font-bold">Nothing in this vibe yet. Check back soon. <span className="text-gigs-pink">✸</span></p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {filtered.map((event) => (
            <EventCard key={event.id} event={event} minPrice={event.min_price ?? null} />
          ))}
        </div>
      )}
    </section>
  );
}
