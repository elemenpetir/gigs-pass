import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Calendar } from "lucide-react";
import { api } from "@/lib/api";
import { formatEventDate, formatCompact } from "@/lib/format";

function Marquee({ items, className = "" }) {
  const doubled = [...items, ...items];
  return (
    <div className={`animate-marquee whitespace-nowrap flex items-center ${className}`}>
      {doubled.map((item, idx) => (
        <span key={idx} className="mx-2">{item}</span>
      ))}
    </div>
  );
}

function Tape({ items, className = "" }) {
  return (
    <div className={`absolute bg-gigs-yellow text-foreground font-black text-lg md:text-xl uppercase tracking-tighter py-1 border-y-4 border-foreground rotate-30 z-30 pointer-events-none select-none flex overflow-hidden ${className}`}>
      <Marquee items={items} />
    </div>
  );
}

function EventImage({ event, ratioClass = "aspect-4/3", grayscale = true }) {
  return (
    <div className={`${ratioClass} brut-border-2 overflow-hidden relative bg-gigs-dark`}>
      {event.image_url ? (
        <img
          src={event.image_url}
          alt={event.title}
          className={`w-full h-full object-cover ${grayscale ? "grayscale group-hover:grayscale-0 transition-all duration-300" : ""}`}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-background/80 font-black uppercase text-2xl tracking-tighter text-center p-4">
          {event.title.slice(0, 12)}
        </div>
      )}
    </div>
  );
}

function Hero({ heroEvent }) {
  return (
    <section className="relative py-8 md:py-12 flex flex-col md:flex-row gap-8 md:gap-4 items-center justify-between">
      <Tape items={["/// WARNING", "/// SELLING FAST"]} className="-right-16 md:-right-24 top-4 md:top-12 w-72 md:w-96" />

      <div className="w-full md:w-3/5 z-10 relative">
        <div className="absolute -top-2.5 -left-5 text-xs font-bold bg-gigs-teal px-2 py-0.5 brut-border-2 -rotate-20 z-20">NO. 01</div>

        <h2 className="text-[2.75rem] sm:text-[3.75rem] md:text-[4.5rem] lg:text-[5.5rem] font-black leading-[0.85] tracking-tighter mix-blend-multiply relative z-10">
          <div className="flex items-baseline">FIND <span className="text-gigs-pink text-[0.5em] ml-4 pb-4">✸</span></div>
          <div className="pl-0 md:pl-12">YOUR</div>
          <div className="relative inline-block text-background bg-foreground px-4 md:px-6 mt-1 -ml-2 brut-shadow">
            NEXT GIG.
          </div>
        </h2>

        <div className="mt-6 md:mt-8 md:pl-12 max-w-md">
          <p className="text-lg md:text-xl font-bold leading-tight mb-6">
            Concerts, festivals, and unforgettable moments.<br />
            Your next story starts here.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href="#whats-hot"
              className="bg-gigs-pink text-foreground font-black uppercase text-lg px-6 py-3 brut-border-4 brut-shadow hover:translate-y-1 hover:translate-x-1 hover:shadow-none transition-all flex items-center justify-between gap-3"
            >
              EXPLORE EVENTS <ArrowRight strokeWidth={4} />
            </a>
            <a
              href="#coming-up"
              className="bg-background text-foreground font-bold uppercase text-base px-5 py-3 brut-border-4 brut-shadow-sm hover:bg-gigs-yellow transition-colors"
            >
              {"WHAT'S HAPPENING?"}
            </a>
          </div>
        </div>
      </div>

      <div className="w-full md:w-2/5 relative mt-6 md:mt-0 flex justify-center md:justify-end">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gigs-orange text-[8rem] font-black rotate-12 opacity-40 z-0 pointer-events-none select-none">
          *
        </div>
        <div className="relative z-10 bg-gigs-yellow brut-border-4 brut-shadow p-2 w-full max-w-72 md:max-w-xs rotate-3 hover:rotate-0 transition-transform duration-300">
          <div className="brut-border-2 overflow-hidden aspect-3/4 relative bg-gigs-dark">
            {heroEvent?.image_url ? (
              <img
                src={heroEvent.image_url}
                alt={heroEvent.title}
                className="w-full h-full object-cover mix-blend-luminosity opacity-80"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-background/90 font-black uppercase text-3xl tracking-tighter text-center p-4">
                GIGS PASS
              </div>
            )}
            <div className="absolute inset-0 bg-linear-to-t from-gigs-dark/80 to-transparent flex flex-col justify-end p-5 text-background">
              <div className="bg-gigs-pink text-foreground text-xs font-black uppercase px-2 py-1 w-fit mb-2 brut-border-2">TONIGHT</div>
              <h3 className="text-2xl font-black leading-none mb-1">{heroEvent ? heroEvent.title.toUpperCase() : "NEON NIGHTS"}</h3>
              {heroEvent && <p className="text-xs font-bold opacity-90">{formatEventDate(heroEvent.event_date)}</p>}
            </div>
          </div>
        </div>

        <div className="absolute -left-2 md:-left-8 md: bg-background brut-border-4 px-3 py-2 -rotate-6 brut-shadow-sm z-20">
          <p className="font-black text-base leading-none uppercase text-center">
            LIVE EVENTS<br />
            <span className="text-2xl">2026</span><br />
            <span className="text-xs text-gigs-teal bg-foreground px-1 mt-1 block">JKT / BDG / BALI</span>
          </p>
        </div>
      </div>
    </section>
  );
}

function HotCard({ event, minPrice, variant }) {
  const link = `/events/${event.id}`;
  if (variant === "purple") {
    return (
      <Link to={link} className="bg-gigs-purple brut-border-4 p-4 brut-shadow brut-card-hover group flex flex-col h-full mt-0 md:mt-8 relative">
        <EventImage event={event} ratioClass="aspect-3/4" grayscale={false} />
        <div className="flex-1 flex flex-col bg-background p-3 brut-border-2">
          <h3 className="text-2xl font-black uppercase leading-tight mb-2">{event.title}</h3>
          <div className="flex flex-col gap-1 text-sm font-bold mb-2">
            <div className="flex items-center gap-2"><Calendar size={16} /> {formatEventDate(event.event_date)}</div>
          </div>
          <div className="mt-auto flex justify-between items-end">
            {minPrice !== null ? (
              <span className="text-xl font-black">FROM {formatCompact(minPrice)}</span>
            ) : (
              <span className="text-xl font-black uppercase">TBA</span>
            )}
            <ArrowRight size={24} strokeWidth={3} className="group-hover:translate-x-2 transition-transform" />
          </div>
        </div>
      </Link>
    );
  }

  if (variant === "teal") {
    return (
      <Link to={link} className="bg-background brut-border-4 p-4 brut-shadow brut-card-hover group flex flex-col h-full relative lg:-mt-4">
        <div className="bg-gigs-teal text-center py-2 mb-4 brut-border-2 font-black uppercase tracking-widest">LIMITED</div>
        <div className="flex-1 flex flex-col">
          <h3 className="text-3xl font-black uppercase leading-none mb-4 group-hover:text-gigs-teal transition-colors">{event.title}</h3>
          <EventImage event={event} ratioClass="aspect-video" />
          <div className="flex flex-col gap-1 text-sm font-bold mb-4 mt-4">
            <div className="flex items-center gap-2"><Calendar size={16} /> {formatEventDate(event.event_date)}</div>
          </div>
          <div className="mt-auto bg-gigs-teal brut-border-2 p-2 flex justify-between items-center">
            <span className="text-lg font-black pl-2">{minPrice !== null ? formatCompact(minPrice) : "TBA"}</span>
            <span className="bg-background px-3 py-1 font-black uppercase text-sm border-2 border-foreground">GET</span>
          </div>
        </div>
      </Link>
    );
  }

  if (variant === "dark") {
    return (
      <Link to={link} className="bg-gigs-dark text-background brut-border-4 p-4 brut-shadow brut-card-hover group flex flex-col h-full mt-0 md:mt-12 relative overflow-hidden">
        <div className="absolute -right-12 -top-12 text-gigs-pink/20 text-9xl font-black rotate-45 z-0 select-none">*</div>
        <div className="relative z-10 flex-1 flex flex-col">
          <h3 className="text-2xl font-black uppercase leading-tight mb-2 text-gigs-yellow">{event.title}</h3>
          <EventImage event={event} ratioClass="aspect-square" grayscale={false} />
          <div className="flex flex-col gap-1 text-sm font-bold mb-4 text-background/80 mt-4">
            <div className="flex items-center gap-2 text-gigs-yellow"><Calendar size={16} /> {formatEventDate(event.event_date)}</div>
          </div>
          <div className="mt-auto border-t-2 border-gigs-yellow/30 pt-4 flex justify-between items-end">
            <div>
              <span className="text-xs font-bold uppercase text-gigs-yellow/60 block mb-1">FROM</span>
              <span className="text-xl font-black">{minPrice !== null ? formatCompact(minPrice) : "TBA"}</span>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // default: light
  return (
    <Link to={link} className="bg-background brut-border-4 p-4 brut-shadow brut-card-hover group flex flex-col h-full relative">
      <div className="absolute -top-3 -right-3 bg-gigs-pink w-8 h-8 rounded-full brut-border-2 flex items-center justify-center font-black text-sm z-10 group-hover:scale-125 transition-transform">1</div>
      <EventImage event={event} />
      <div className="flex-1 flex flex-col">
        <h3 className="text-2xl font-black uppercase leading-tight mb-2 group-hover:text-gigs-pink transition-colors">{event.title}</h3>
        <div className="flex flex-col gap-1 text-sm font-bold mb-4">
          <div className="flex items-center gap-2"><Calendar size={16} /> {formatEventDate(event.event_date)}</div>
        </div>
        <div className="mt-auto pt-4 border-t-2 border-dashed border-foreground/30 flex justify-between items-end">
          <div>
            <span className="text-xs font-bold uppercase text-gray-500 block mb-1">FROM</span>
            <span className="text-xl font-black">{minPrice !== null ? formatCompact(minPrice) : "TBA"}</span>
          </div>
          <span className="bg-foreground text-background px-4 py-2 font-black uppercase text-sm hover:bg-gigs-pink transition-colors">BUY</span>
        </div>
      </div>
    </Link>
  );
}

const HOT_VARIANTS = ["light", "purple", "teal", "dark"];

export default function Home() {
  const [events, setEvents] = useState([]);
  const [prices, setPrices] = useState({});
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

        const priceEntries = await Promise.all(
          list.map(async (event) => {
            try {
              const catData = await api.get(`/events/${event.id}/categories`);
              const cats = catData.categories || [];
              const pricesList = cats.map((c) => Number(c.price)).filter((p) => Number.isFinite(p));
              return [event.id, pricesList.length ? Math.min(...pricesList) : null];
            } catch {
              return [event.id, null];
            }
          }),
        );
        if (!cancelled) setPrices(Object.fromEntries(priceEntries));
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load events");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const hot = events.slice(0, 4);
  const heroEvent = events.find((e) => e.image_url) || events[0];

  return (
    <>
      {/* HERO */}
      {loading ? (
        <section className="min-h-[70vh] flex items-center justify-center">
          <div className="w-48 h-48 border-4 border-foreground bg-gigs-yellow animate-pulse brut-shadow" />
        </section>
      ) : error ? (
        <section className="py-24 text-center">
          <h2 className="text-5xl font-black uppercase tracking-tighter mb-4">something went wrong</h2>
          <p className="border-2 border-error bg-error/10 text-error font-bold px-4 py-3 uppercase text-sm inline-block">{error}</p>
        </section>
      ) : (
        <Hero heroEvent={heroEvent} />
      )}

      {/* MARQUEE */}
      <div className="bg-gigs-pink text-foreground font-black text-2xl md:text-3xl uppercase tracking-tighter py-3 brut-border-4 brut-shadow border-x-0 -mx-4 md:-mx-8 px-4 md:px-8 w-[calc(100%+2rem)] md:w-[calc(100%+4rem)] overflow-hidden -rotate-1 my-12 relative z-20">
        <Marquee items={["SECURE YOUR SPOT", "✸", "NO HIDDEN FEES", "✸", "FESTIVALS", "✸", "UNDERGROUND GIGS", "✸", "SOLD OUT SHOWS", "✸"]} />
      </div>

      {/* WHAT'S HOT */}
      <section id="whats-hot" className="py-16 md:py-24 border-t-4 border-foreground mt-8 relative">
        <Tape items={["/// SOLD OUT", "/// TOO LATE"]} className="-top-8 -left-20 md:-left-24 w-72 md:w-96 -rotate-45" />

        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12">
          <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter">{"WHAT'S HOT "}<span className="text-gigs-orange">🔥</span></h2>
          <a href="#coming-up" className="font-bold uppercase text-lg border-b-4 border-foreground hover:text-gigs-purple hover:border-gigs-purple pb-1 transition-colors mt-4 md:mt-0">View All</a>
        </div>

        {events.length === 0 ? (
          <div className="border-4 border-foreground bg-canvas p-12 text-center">
            <h3 className="text-3xl font-black uppercase tracking-tighter mb-2">no events yet</h3>
            <p className="font-bold">New gigs are being loaded. Check back soon. <span className="text-gigs-pink">✸</span></p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {hot.map((event, idx) => (
              <HotCard key={event.id} event={event} minPrice={prices[event.id] ?? null} variant={HOT_VARIANTS[idx % HOT_VARIANTS.length]} />
            ))}
          </div>
        )}
      </section>

      {/* BROWSE VIBES */}
      <section className="py-16 md:py-24 border-t-4 border-foreground relative">
        <Tape items={["/// ALL ACCESS", "/// VIP ONLY"]} className="-bottom-12 -right-16 md:-right-24 w-72 md:w-96 -rotate-45" />
        <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter mb-8">BROWSE <span className="bg-foreground text-background px-2">VIBES</span></h2>
        <div className="flex flex-wrap gap-4 md:gap-6">
          {["[MUSIC]", "[FESTIVAL]", "[CONCERT]", "[COMEDY]", "[ART]", "[CULTURE]"].map((cat, idx) => {
            const styles = [
              "hover:text-gigs-pink hover:rotate-2",
              "text-background bg-foreground hover:bg-gigs-yellow hover:text-foreground px-2 md:px-4 -rotate-1 hover:-rotate-3",
              "hover:text-gigs-teal hover:rotate-1",
              "border-4 border-foreground hover:bg-gigs-purple hover:border-gigs-purple px-2 md:px-4 rotate-2 hover:rotate-0",
              "text-gigs-orange hover:text-foreground -rotate-2",
              "hover:text-gigs-pink underline decoration-8 underline-offset-8 decoration-gigs-teal",
            ];
            return (
              <a key={cat} href="#coming-up" className={`text-5xl md:text-7xl font-black uppercase tracking-tighter transition-colors ${styles[idx]}`}>
                {cat}
              </a>
            );
          })}
        </div>
      </section>

      {/* COMING UP */}
      <section id="coming-up" className="py-16 md:py-24 border-t-4 border-foreground bg-foreground text-background -mx-4 md:-mx-8 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-12 flex items-center gap-4">
            COMING UP <ArrowRight size={48} className="text-gigs-pink" strokeWidth={4} />
          </h2>

          <div className="flex flex-col border-t-2 border-background/20">
            <div className="hidden md:grid grid-cols-12 gap-4 py-4 border-b-2 border-background/20 text-sm font-bold text-background/50 uppercase tracking-widest">
              <div className="col-span-3">DATE</div>
              <div className="col-span-5">EVENT</div>
              <div className="col-span-2">PRICE</div>
              <div className="col-span-2 text-right">ACTION</div>
            </div>

            {events.map((event) => (
              <Link key={event.id} to={`/events/${event.id}`} className="group grid grid-cols-1 md:grid-cols-12 gap-4 py-6 border-b-2 border-background/20 items-center hover:bg-background/10 transition-colors cursor-pointer">
                <div className="col-span-1 md:col-span-3 text-xl font-bold">{formatEventDate(event.event_date)}</div>
                <div className="col-span-1 md:col-span-5">
                  <h3 className="text-3xl font-black uppercase group-hover:text-gigs-yellow transition-colors">{event.title}</h3>
                </div>
                <div className="col-span-1 md:col-span-2 font-bold">{prices[event.id] !== null ? formatCompact(prices[event.id]) : "TBA"}</div>
                <div className="col-span-1 md:col-span-2 md:text-right mt-4 md:mt-0">
                  <span className="bg-gigs-yellow text-foreground px-4 py-2 font-black uppercase text-sm brut-border-2 opacity-0 group-hover:opacity-100 transition-opacity inline-block">TICKETS</span>
                </div>
              </Link>
            ))}

            {events.length === 0 && (
              <div className="py-10 text-background/70 font-bold uppercase text-xl text-center">Nothing scheduled yet — be the first in line.</div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}