import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Clock, Ticket } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatEventDate, formatIDR } from "@/lib/format";

function formatCountdown(totalSeconds) {
  const s = Math.max(0, totalSeconds);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function CheckoutPage() {
  const { eventId, categoryId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [event, setEvent] = useState(null);
  const [category, setCategory] = useState(null);
  const [order, setOrder] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(300);
  const [status, setStatus] = useState("loading"); // loading | locked | paid | expired | failed | soldout | busy
  const [error, setError] = useState("");
  const deadlineRef = useRef(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!user) {
      navigate("/login", { state: { from: `/events/${eventId}/checkout/${categoryId}` } });
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
        const cat = (catData.categories || []).find((c) => String(c.id) === String(categoryId)) || null;
        setCategory(cat);

        let reserved = false;
        try {
          const lockRes = await api.post(`/checkout/${categoryId}/lock`);
          const ttl = Number(lockRes?.expiresInSeconds) || 300;
          deadlineRef.current = Date.now() + ttl * 1000;
          reserved = true;
        } catch (lockErr) {
          if (lockErr.status === 403) {
            if (!cancelled) { setStatus("busy"); setError("Join the queue first — your gate pass expired."); }
            return;
          }
          if (!cancelled) { setStatus("busy"); setError(lockErr.message || "Could not reserve your spot."); }
          return;
        }

        if (!cancelled && !reserved) { setStatus("busy"); setError("Could not reserve your spot."); return; }

        try {
          const orderRes = await api.post("/orders", { categoryId });
          if (cancelled) return;
          setOrder(orderRes.order);
          setStatus("locked");
        } catch (orderErr) {
          if (cancelled) return;
          const existing = orderErr.status === 409 ? orderErr.data?.order : null;
          if (existing && existing.status === "awaiting_payment") {
            setOrder(existing);
            setStatus("locked");
            return;
          }
          setStatus("busy");
          setError(orderErr.message || "Checkout failed");
        }
      } catch (err) {
        if (!cancelled) {
          setStatus("busy");
          setError(err.message || "Checkout failed");
        }
      }
    })();

    return () => { cancelled = true; };
  }, [eventId, categoryId, user, navigate]);

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  useEffect(() => {
    if (status !== "locked") return;
    stopTimer();
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0) {
        stopTimer();
        setStatus("expired");
      }
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return stopTimer;
  }, [status]);

  const pay = async (success) => {
    if (!order || status !== "locked") return;
    setError("");
    setStatus("busy");
    try {
      const res = await api.post(`/orders/${order.id}/pay`, { success });
      stopTimer();
      setOrder(res.order);
      setStatus(success ? "paid" : "failed");
    } catch (err) {
      setStatus("locked");
      setError(err.message || "Payment failed to process");
    }
  };

  const price = Number(order?.amount ?? category?.price ?? 0);
  const urgent = secondsLeft <= 60;

  const renderTicketPanel = () => {
    if (status === "paid") {
      return (
        <div className="border-4 border-foreground bg-gigs-teal p-10 brut-shadow text-center">
          <span className="bg-foreground text-background px-2 py-1 brut-border-2 text-sm font-black uppercase tracking-widest inline-block mb-4">ticket secured</span>
          <h2 className="text-6xl md:text-8xl font-black uppercase tracking-tighter leading-[0.85]">SEE YOU<br />THERE.</h2>
          <p className="mt-6 font-black uppercase text-lg">Your ticket is paid & locked in.</p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/orders" className="bg-foreground text-background px-6 py-3 font-black uppercase brut-border-2 brut-button">MY ORDERS →</Link>
            <Link to="/" className="bg-background px-6 py-3 font-black uppercase brut-border-2 brut-button hover:bg-gigs-yellow">BACK TO DISCOVER</Link>
          </div>
        </div>
      );
    }

    if (status === "soldout") {
      return (
        <div className="border-4 border-foreground bg-error/10 p-10 brut-shadow text-center">
          <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter leading-[0.9]">OWNED.<br />SOLD OUT.</h2>
          <p className="mt-6 font-black uppercase text-lg">This tier is gone. Try another queue next time. <span className="text-gigs-pink">✸</span></p>
          <Link to={`/events/${eventId}`} className="mt-8 inline-block bg-foreground text-background px-6 py-3 font-black uppercase brut-border-2 brut-button">BACK TO EVENT</Link>
        </div>
      );
    }

    if (status === "expired") {
      return (
        <div className="border-4 border-foreground bg-gigs-orange p-10 brut-shadow text-center">
          <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter leading-[0.9]">TOO SLOW.<br />SPOT GONE.</h2>
          <p className="mt-6 font-black uppercase text-lg">Your lock expired and the slot went back to the pool.</p>
          <Link to={`/events/${eventId}`} className="mt-8 inline-block bg-foreground text-background px-6 py-3 font-black uppercase brut-border-2 brut-button">REJOIN QUEUE →</Link>
        </div>
      );
    }

    if (status === "failed") {
      return (
        <div className="border-4 border-foreground bg-gigs-purple p-10 brut-shadow text-center">
          <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter leading-[0.9]">PAYMENT<br />FAILED.</h2>
          <p className="mt-6 font-black uppercase text-lg">Your spot was released back to the pool. One buyer = one shot.</p>
          <Link to={`/events/${eventId}`} className="mt-8 inline-block bg-foreground text-background px-6 py-3 font-black uppercase brut-border-2 brut-button">REJOIN QUEUE →</Link>
        </div>
      );
    }

    if (status === "busy") {
      return (
        <div className="border-4 border-foreground bg-gigs-yellow p-10 brut-shadow text-center">
          <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter leading-[0.9]">HOLD ON.</h2>
          <p className="mt-6 border-2 border-error bg-error/10 text-error font-bold px-4 py-3 uppercase text-sm inline-block">{error || "Processing…"}</p>
          <div className="mt-8">
            <Link to={`/events/${eventId}`} className="bg-foreground text-background px-6 py-3 font-black uppercase brut-border-2 brut-button">← BACK TO EVENT</Link>
          </div>
        </div>
      );
    }

    // locked
    return (
      <div className="border-4 border-foreground p-10 brut-shadow bg-background">
        <div className="flex items-center justify-between mb-8">
          <div>
            <span className="text-sm font-black uppercase tracking-widest text-foreground/60">PAY WITHIN</span>
            <div className={`text-7xl md:text-8xl font-black leading-none tracking-tighter font-mono ${urgent ? "text-error animate-pulse" : ""}`}>
              {formatCountdown(secondsLeft)}
            </div>
          </div>
          <Clock size={40} strokeWidth={3} className={urgent ? "text-error animate-pulse" : "text-foreground"} />
        </div>

        <div className="border-t-4 border-foreground pt-6 mb-8">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold uppercase text-gray-500 mb-1">EVENT</p>
              <h3 className="text-2xl font-black uppercase tracking-tighter">{event?.title}</h3>
              <p className="text-sm font-bold mt-1">{event && formatEventDate(event.event_date)}</p>
            </div>
          </div>
          <div className="flex justify-between items-center mt-4 border-t-2 border-dashed border-foreground/30 pt-4">
            <div className="flex items-center gap-2">
              <Ticket size={18} strokeWidth={3} />
              <span className="font-black uppercase tracking-tight">{category?.name}</span>
            </div>
            <span className="text-3xl font-black">{Number.isFinite(price) ? formatIDR(price) : "TBA"}</span>
          </div>
        </div>

        {error && (
          <p className="border-2 border-error bg-error/10 text-error font-bold px-4 py-3 uppercase text-sm mb-6">{error}</p>
        )}

        <div className="flex flex-col sm:flex-row gap-4">
          <button
            type="button"
            onClick={() => pay(true)}
            className="flex-1 bg-gigs-pink text-foreground font-black uppercase text-lg px-6 py-4 brut-border-4 brut-shadow brut-button flex items-center justify-between gap-4"
          >
            PAY NOW <ArrowRight strokeWidth={4} />
          </button>
          <button
            type="button"
            onClick={() => pay(false)}
            className="flex-1 bg-background text-foreground font-bold uppercase text-lg px-6 py-4 brut-border-4 brut-button hover:bg-gigs-yellow"
          >
            SIMULATE FAILED PAYMENT
          </button>
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-wide text-foreground/60">
          Mock payment for MVP. One buyer = one shot — if payment fails you must rejoin the queue.
        </p>
      </div>
    );
  };

  return (
    <section className="py-16 flex justify-center">
      <div className="w-full max-w-2xl">
        <nav className="mb-10 font-bold uppercase text-sm">
          <Link to={`/events/${eventId}`} className="hover:text-gigs-pink transition-colors">← {event?.title || "BACK TO EVENT"}</Link>
        </nav>

        {status === "loading" ? (
          <div className="flex justify-center py-24">
            <div className="w-40 h-40 border-4 border-foreground bg-gigs-teal animate-pulse brut-shadow" />
          </div>
        ) : (
          <>
            <div className="mb-8">
              <span className="text-sm font-black uppercase tracking-widest bg-foreground text-background px-2 py-1 brut-border-2">CHECKOUT</span>
              <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mt-4 leading-[0.9]">
                {status === "paid" ? "LOCKED IN" : "ALMOST THERE."}
              </h1>
            </div>
            <div className="flex items-center justify-center gap-2 mb-8 text-sm font-black uppercase tracking-widest">
              <span className="w-3 h-3 bg-foreground rounded-full" /> 1. QUEUE JOINED <span className="text-gigs-pink">✸</span> 2. SPOT HELD <span className="text-gigs-pink">✸</span> 3. YOU PAY
            </div>
            {renderTicketPanel()}
          </>
        )}
      </div>
    </section>
  );
}