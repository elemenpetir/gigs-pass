import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { ArrowRight, Ticket } from "lucide-react";
import { api, BASE_URL, getToken } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatEventDate } from "@/lib/format";

function WaitingTape() {
  const items = ["ONCE YOU'RE IN", "✸", "GRAB YOUR TICKET FAST", "✸", "YOUR SPOT EXPIRES", "✸", "ONE BUYER = ONE TICKET", "✸"];
  const doubled = [...items, ...items];
  return (
    <div className="w-full bg-gigs-pink text-foreground font-black text-lg md:text-xl uppercase tracking-tighter py-2 brut-border-4 border-x-0 -mx-4 md:-mx-8 px-4 md:px-8 w-[calc(100%+2rem)] md:w-[calc(100%+4rem)] overflow-hidden rotate-[-1deg] my-10">
      <div className="animate-marquee whitespace-nowrap flex items-center">
        {doubled.map((item, idx) => (
          <span key={idx} className="mx-3">{item}</span>
        ))}
      </div>
    </div>
  );
}

export default function WaitingRoomPage() {
  const { eventId, categoryId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [event, setEvent] = useState(null);
  const [category, setCategory] = useState(null);
  const [position, setPosition] = useState(null);
  const [joined, setJoined] = useState(false);
  const [granted, setGranted] = useState(false);
  const [error, setError] = useState("");
  const ctrlRef = useRef(null);

  useEffect(() => {
    if (!user) {
      navigate("/login", { state: { from: `/events/${eventId}/join/${categoryId}` } });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [eventData, catData] = await Promise.all([
          api.get(`/events/${eventId}`),
          api.get(`/events/${eventId}/categories`),
        ]);
        if (cancelled) return;
        setEvent(eventData.event);
        setCategory((catData.categories || []).find((c) => String(c.id) === String(categoryId)) || null);

        const joinRes = await api.post(`/queue/${categoryId}/join`, null);
        if (cancelled) return;
        setPosition(joinRes.position ?? null);
        setJoined(true);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to join the queue");
      }
    })();
    return () => { cancelled = true; };
  }, [eventId, categoryId, user, navigate]);

  useEffect(() => {
    if (!joined) return;
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    let active = true;

    (async () => {
      try {
        await fetchEventSource(`${BASE_URL}/queue/${categoryId}/stream`, {
          headers: { Authorization: `Bearer ${getToken()}` },
          signal: ctrl.signal,
          onopen: async (res) => {
            if (!res.ok) throw new Error(`Stream error ${res.status}`);
          },
          onmessage: (ev) => {
            if (!active) return;
            if (ev.event === "position") {
              const data = JSON.parse(ev.data);
              if (typeof data.position === "number") setPosition(data.position);
            }
            if (ev.event === "granted") {
              setGranted(true);
              ctrl.abort();
              setTimeout(() => navigate(`/events/${eventId}/checkout/${categoryId}`), 1400);
            }
            if (ev.event === "error") {
              const data = JSON.parse(ev.data);
              if (active) setError(data.message || "Queue stream error");
            }
          },
          onerror: (err) => {
            if (!active) return;
            console.warn("SSE error", err);
            return;
          },
        });
      } catch (err) {
        if (active && !ctrl.signal.aborted) setError(err.message || "Queue stream failed");
      }
    })();

    return () => { active = false; ctrl.abort(); };
  }, [joined, eventId, categoryId, navigate]);

  if (error && !granted) {
    return (
      <section className="py-24 text-center">
        <h2 className="text-5xl font-black uppercase tracking-tighter mb-4">queue broke down</h2>
        <p className="border-2 border-error bg-error/10 text-error font-bold px-4 py-3 uppercase text-sm inline-block">{error}</p>
        <div className="mt-8">
          <Link to={`/events/${eventId}`} className="bg-foreground text-background px-6 py-3 font-black uppercase brut-border-2 brut-button">← BACK TO EVENT</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 flex justify-center">
      <div className="w-full max-w-2xl text-center">
        <nav className="mb-10 text-left font-bold uppercase text-sm">
          <Link to={`/events/${eventId}`} className="hover:text-gigs-pink transition-colors">← {event?.title || "BACK TO EVENT"}</Link>
        </nav>

        <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter leading-[0.9]">
          ONE TICKET<br />TO THE <span className="bg-foreground text-background px-2 brut-shadow inline-block mt-2 -rotate-2">FRONT.</span>
        </h1>

        {category && (
          <p className="mt-4 font-bold uppercase tracking-widest text-gigs-dark">
            {event?.title} · {category.name}
          </p>
        )}

        <WaitingTape />

        <div className={`border-4 border-foreground p-10 brut-shadow relative ${granted ? "bg-gigs-teal" : "bg-gigs-yellow"}`}>
          {granted ? (
            <>
              <div className="text-sm font-black uppercase tracking-widest bg-foreground text-background px-2 py-1 w-fit mx-auto mb-4">YOU'RE IN</div>
              <div className="text-7xl md:text-9xl font-black leading-none tracking-tighter">GRAB IT</div>
              <p className="mt-4 font-black uppercase text-lg">Redirecting to checkout…</p>
            </>
          ) : (
            <>
              <div className="flex items-center justify-center gap-2 mb-6">
                <Ticket size={20} strokeWidth={3} className="animate-bounce" />
                <span className="text-sm font-black uppercase tracking-widest">SECURING YOUR SPOT</span>
                <span className="flex gap-1 ml-1">
                  <span className="w-2 h-2 bg-foreground rounded-full animate-pulse" />
                  <span className="w-2 h-2 bg-foreground rounded-full animate-pulse [animation-delay:150ms]" />
                  <span className="w-2 h-2 bg-foreground rounded-full animate-pulse [animation-delay:300ms]" />
                </span>
              </div>

              <div className="text-8xl md:text-9xl font-black leading-none tracking-tighter">
                {position ?? "—"}
              </div>
              <p className="mt-3 font-black uppercase text-lg">
                {position === 1 ? "you're next — stand by" : "people ahead of you"}
              </p>
            </>
          )}
        </div>

        <p className="mt-8 text-sm font-bold text-foreground/70 max-w-md mx-auto uppercase tracking-wide">
          Keep this tab open. Your place in line refreshes in real time — when you reach the front, we'll send you straight to checkout. One buyer = one ticket. <span className="text-gigs-pink">✸</span>
        </p>
      </div>
    </section>
  );
}