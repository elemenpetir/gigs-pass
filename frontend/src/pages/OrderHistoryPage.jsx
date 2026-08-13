import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Ticket } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatEventDate, formatIDR } from "@/lib/format";

const STATUS_STYLES = {
  awaiting_payment: { label: "AWAITING PAYMENT", cls: "bg-gigs-yellow text-foreground border-foreground" },
  pending: { label: "CONFIRMED", cls: "bg-gigs-teal text-ink border-foreground" },
  holding_period: { label: "HOLDING PERIOD", cls: "bg-gigs-purple text-ink border-foreground" },
  released: { label: "RELEASED", cls: "bg-gigs-teal text-ink border-foreground" },
  held: { label: "HELD", cls: "bg-gigs-orange text-ink border-foreground" },
  refunded: { label: "REFUNDED", cls: "bg-error text-background border-foreground" },
  expired: { label: "EXPIRED", cls: "bg-canvas text-foreground/60 border-foreground" },
};

const REFUND_REASON_LABEL = {
  event_cancelled: "EVENT CANCELLED BY THE ORGANIZER",
  admin_override: "ADMIN PUTUSAN",
};

export default function OrderHistoryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      navigate("/login", { state: { from: location.pathname } });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get("/orders");
        if (!cancelled) setOrders(data.orders || []);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load orders");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, navigate, location.pathname]);

  const statusBadge = (status, reason) => {
    const s = STATUS_STYLES[status] || { label: status, cls: "bg-canvas text-ink border-foreground" };
    return (
      <span>
        <span className={`inline-flex items-center rounded-none px-2 py-1 text-xs font-black uppercase tracking-widest brut-border-2 ${s.cls}`}>{s.label}</span>
        {status === "refunded" && reason && (
          <span className="ml-2 inline-block text-xs font-black uppercase tracking-widest text-foreground/60">{REFUND_REASON_LABEL[reason] || reason}</span>
        )}
      </span>
    );
  };

  if (loading) {
    return (
      <section className="py-20 flex justify-center">
        <div className="w-40 h-40 border-4 border-foreground bg-gigs-purple animate-pulse brut-shadow" />
      </section>
    );
  }

  return (
    <section className="py-16">
      <nav className="mb-10 font-bold uppercase text-sm">
        <Link to="/" className="hover:text-gigs-pink transition-colors">← DISCOVER</Link>
      </nav>

      <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-2 flex items-center gap-4">
        MY <span className="bg-foreground text-background px-2 brut-shadow -rotate-2 inline-block">ORDERS</span>
      </h1>
      <p className="font-bold text-lg mb-10">{"Every stub you've punched, in one place."}</p>

      {error ? (
        <div className="text-center py-10">
          <p className="border-2 border-error bg-error/10 text-error font-bold px-4 py-3 uppercase text-sm inline-block">{error}</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="border-4 border-foreground bg-canvas p-12 text-center">
          <Ticket size={48} strokeWidth={3} className="mx-auto mb-4 text-gigs-pink" />
          <h2 className="text-3xl font-black uppercase tracking-tighter mb-2">no tickets yet</h2>
          <p className="font-bold">Your story starts here. Go find your next gig. <span className="text-gigs-pink">✸</span></p>
          <Link to="/" className="mt-8 inline-block bg-gigs-pink text-foreground px-6 py-3 font-black uppercase brut-border-2 brut-button">EXPLORE EVENTS →</Link>
        </div>
      ) : (
        <div className="flex flex-col">
          <div className="hidden md:grid grid-cols-12 gap-4 py-4 border-b-4 border-foreground text-sm font-bold uppercase tracking-widest">
            <div className="col-span-4">EVENT</div>
            <div className="col-span-3">TICKET</div>
            <div className="col-span-2">AMOUNT</div>
            <div className="col-span-3 text-right">STATUS</div>
          </div>

          {orders.map((order) => (
            <div key={order.id} className="group grid grid-cols-1 md:grid-cols-12 gap-4 py-6 border-b-2 border-foreground/30 items-center hover:bg-surface-card transition-colors">
              <div className="col-span-1 md:col-span-4">
                <Link to={`/events/${order.event_id}`} className="group-hover:text-gigs-pink transition-colors">
                  <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tight leading-tight">{order.event_title}</h3>
                  <p className="text-sm font-bold text-foreground/70 mt-1">{formatEventDate(order.event_date)}</p>
                </Link>
              </div>
              <div className="col-span-1 md:col-span-3 font-bold uppercase">{order.category_name}</div>
              <div className="col-span-1 md:col-span-2 font-black text-lg">{formatIDR(order.amount)}</div>
              <div className="col-span-1 md:col-span-3 md:text-right">{statusBadge(order.status, order.refund_reason)}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}