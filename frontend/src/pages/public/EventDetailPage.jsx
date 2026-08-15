import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Calendar, Ticket } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatEventDate, formatIDR } from "@/lib/format";

function MarqueeLine() {
  const items = ["SECURE YOUR SPOT", "✸", "ONE TICKET", "✸", "NO HIDDEN FEES", "✸", "FESTIVALS", "✸", "UNDERGROUND GIGS", "✸"];
  const doubled = [...items, ...items];
  return (
    <div className="w-full bg-gigs-yellow text-foreground font-black text-xl md:text-2xl uppercase tracking-tighter py-2 brut-border-4 -mx-4 md:-mx-8 px-4 md:px-8 md:w-[calc(100%+4rem)] -rotate-1 my-10 overflow-hidden">
      <div className="animate-marquee whitespace-nowrap flex items-center">
        {doubled.map((item, idx) => (
          <span key={idx} className="mx-3">{item}</span>
        ))}
      </div>
    </div>
  );
}

export default function EventDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [event, setEvent] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [eventData, catData] = await Promise.all([
          api.get(`/events/${id}`),
          api.get(`/events/${id}/categories`),
        ]);
        if (cancelled) return;
        setEvent(eventData.event);
        setCategories(catData.categories || []);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load event");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const goJoinQueue = (categoryId) => {
    if (!user) {
      navigate("/login", { state: { from: `/events/${id}/join/${categoryId}` } });
      return;
    }
    navigate(`/events/${id}/join/${categoryId}`);
  };

  const cardColors = ["bg-gigs-pink", "bg-gigs-purple", "bg-gigs-teal", "bg-gigs-orange", "bg-gigs-yellow"];

  if (loading) {
    return (
      <section className="py-20 flex justify-center">
        <div className="w-40 h-40 border-4 border-foreground bg-gigs-purple animate-pulse brut-shadow" />
      </section>
    );
  }

  if (error || !event) {
    return (
      <section className="py-24 text-center">
        <h2 className="text-5xl font-black uppercase tracking-tighter mb-4">event not found</h2>
        <p className="border-2 border-error bg-error/10 text-error font-bold px-4 py-3 uppercase text-sm inline-block">{error || "No such event."}</p>
        <div className="mt-8">
          <Link to="/" className="bg-foreground text-background px-6 py-3 font-black uppercase brut-border-2 brut-button">← BACK TO DISCOVER</Link>
        </div>
      </section>
    );
  }

  return (
    <>
      <nav className="pt-6 font-bold uppercase text-sm">
        <Link to="/" className="hover:text-gigs-pink transition-colors">← DISCOVER</Link>
        <span className="mx-2 text-foreground/40">/</span>
        <span className="font-black">{event.title}</span>
      </nav>

      <section className="py-10 md:py-14 grid grid-cols-1 lg:grid-cols-5 gap-10 items-start">
        {/* Poster */}
        <div className="lg:col-span-2 relative z-10 bg-gigs-yellow brut-border-4 brut-shadow p-2 rotate-1 hover:rotate-0 transition-transform duration-300">
          <div className="brut-border-2 overflow-hidden aspect-3/4 relative bg-gigs-dark">
            {event.image_url ? (
              <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-background font-black uppercase tracking-tighter text-center p-6 text-4xl">
                {event.title}
              </div>
            )}
          </div>
        </div>

        {/* Title + meta */}
        <div className="lg:col-span-3 relative">
          <div className="text-sm font-bold bg-gigs-teal px-2 py-1 brut-border-2 -rotate-2 inline-block mb-6">NOW ON SALE</div>
          <h1 className="text-6xl md:text-8xl font-black uppercase leading-[0.9] tracking-tighter">{event.title}</h1>
          <div className="mt-8 flex flex-wrap items-center gap-3 font-black uppercase">
            <span className="inline-flex items-center gap-2 bg-foreground text-background px-4 py-2 brut-border-2">
              <Calendar size={18} strokeWidth={3} /> {formatEventDate(event.event_date)}
            </span>
          </div>

          <div className="mt-10 hidden md:block">
            <p className="text-body-strong font-bold text-lg max-w-2xl whitespace-pre-line">{event.description || "No description yet — expect chaos. In a good way."}</p>
          </div>
        </div>
      </section>

      <div className="md:hidden pb-8">
        <p className="font-bold text-lg whitespace-pre-line">{event.description || "No description yet — expect chaos. In a good way."}</p>
      </div>

      <MarqueeLine />

      {/* Ticket categories */}
      <section className="pb-16 md:pb-24 border-t-4 border-foreground pt-12 relative">
        <h2 className="text-5xl md:text-6xl font-black uppercase tracking-tighter mb-2">GRAB YOUR <span className="bg-foreground text-background px-2">TICKET</span></h2>
        <p className="font-bold text-lg mb-10">One shot per buyer — your spot is reserved while you pay.</p>

        {categories.length === 0 ? (
          <div className="border-4 border-foreground p-12 text-center bg-canvas">
            <h3 className="text-3xl font-black uppercase tracking-tighter mb-2">tickets not live yet</h3>
            <p className="font-bold">This event {"hasn't"} opened its gates. Join the vibe later. <span className="text-gigs-pink">✸</span></p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {categories.map((cat, idx) => {
              const price = Number(cat.price);
              return (
                <div key={cat.id} className="bg-background border-4 border-foreground brut-shadow brut-card-hover p-6 flex flex-col relative">
                  <div className={`absolute -top-3 -right-3 w-10 h-10 rounded-full brut-border-2 flex items-center justify-center font-black text-sm z-10 ${cardColors[idx % cardColors.length]}`}>{idx + 1}</div>

                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-3xl font-black uppercase tracking-tighter">{cat.name}</h3>
                    <Ticket size={24} strokeWidth={3} />
                  </div>

                  <div className="flex-1 flex flex-col justify-end gap-6">
                    <div className="flex items-end justify-between border-t-2 border-dashed border-foreground/30 pt-4">
                      <div>
                        <span className="text-xs font-bold uppercase text-gray-500 block mb-1">PRICE</span>
                        <span className="text-3xl font-black">{Number.isFinite(price) ? formatIDR(price) : "TBA"}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold uppercase text-gray-500 block mb-1">QUOTA</span>
                        <span className="text-2xl font-black">{cat.quota}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => goJoinQueue(cat.id)}
                      className="bg-gigs-pink text-foreground font-black uppercase text-lg px-6 py-4 brut-border-4 brut-shadow brut-button flex items-center justify-between gap-4 w-full"
                    >
                      JOIN QUEUE <ArrowRight strokeWidth={4} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}