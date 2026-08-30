import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
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

export default function OrderDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [order, setOrder] = useState(null);
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
        const data = await api.get(`/orders/${id}`);
        if (!cancelled) setOrder(data.order || null);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load order");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, user, navigate, location.pathname]);

  if (loading) {
    return (
      <section className="py-20 flex justify-center">
        <div className="w-40 h-40 border-4 border-foreground bg-gigs-purple animate-pulse brut-shadow" />
      </section>
    );
  }

  if (error || !order) {
    return (
      <section className="py-24 text-center">
        <h2 className="text-5xl font-black uppercase tracking-tighter mb-4">stub not found</h2>
        <p className="border-2 border-error bg-error/10 text-error font-bold px-4 py-3 uppercase text-sm inline-block">{error || "No such order."}</p>
        <div className="mt-8">
          <Link to="/orders" className="bg-foreground text-background px-6 py-3 font-black uppercase brut-border-2 brut-button">← BACK TO MY ORDERS</Link>
        </div>
      </section>
    );
  }

  const s = STATUS_STYLES[order.status] || { label: order.status, cls: "bg-canvas text-ink border-foreground" };

  return (
    <section className="py-16 flex justify-center">
      <div className="w-full max-w-xl">
        <nav className="mb-10 font-bold uppercase text-sm">
          <Link to="/orders" className="hover:text-gigs-pink transition-colors">← MY ORDERS</Link>
        </nav>

        <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-2 flex items-center gap-4">
          YOUR <span className="bg-foreground text-background px-2 brut-shadow -rotate-2 inline-block">STUB</span>
        </h1>
        <p className="font-bold text-lg mb-10">Proof of purchase. Punch it twice. <span className="text-gigs-pink">✸</span></p>

        <div className="border-4 border-foreground bg-background brut-shadow">
          <div className="flex items-center justify-between gap-4 border-b-4 border-dashed border-foreground/40 px-6 py-5 bg-gigs-yellow">
            <div>
              <span className="text-xs font-black uppercase tracking-widest block mb-1">ORDER #{String(order.id).slice(0, 8).toUpperCase()}</span>
              <span className={`inline-flex items-center rounded-none px-2 py-1 text-xs font-black uppercase tracking-widest brut-border-2 ${s.cls}`}>{s.label}</span>
              {order.status === "refunded" && order.refund_reason && (
                <span className="ml-2 inline-block text-xs font-black uppercase tracking-widest text-foreground/60">{REFUND_REASON_LABEL[order.refund_reason] || order.refund_reason}</span>
              )}
            </div>
            <Ticket size={32} strokeWidth={3} />
          </div>

          <div className="px-6 py-6">
            <Link to={`/events/${order.event_id}`} className="group block">
              <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-[0.9] group-hover:text-gigs-pink transition-colors">{order.event_title}</h2>
              <p className="mt-2 font-bold uppercase text-foreground/70">{formatEventDate(order.event_date)}</p>
            </Link>
          </div>

          <div className="border-t-2 border-dashed border-foreground/40 px-6 py-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-gray-500">TICKET</span>
              <span className="font-black uppercase text-lg">{order.category_name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-gray-500">AMOUNT</span>
              <span className="font-black text-2xl">{formatIDR(order.amount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-gray-500">PLACED ON</span>
              <span className="font-bold uppercase text-sm">{formatEventDate(order.created_at)}</span>
            </div>
            {order.paid_at && (
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-gray-500">PAID ON</span>
                <span className="font-bold uppercase text-sm">{formatEventDate(order.paid_at)}</span>
              </div>
            )}
            {order.holding_until && (
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-gray-500">FUNDS HELD UNTIL</span>
                <span className="font-bold uppercase text-sm">{formatEventDate(order.holding_until)}</span>
              </div>
            )}
          </div>

          <div className="border-t-4 border-dashed border-foreground/40 px-6 py-5 text-center">
            <p className="font-black uppercase tracking-widest text-sm">
              {order.status === "expired" ? "THIS SPOT EXPIRED — SEE YOU AT THE NEXT ONE." : "ONE DANCE. ONE NIGHT. ONE YOU."} <span className="text-gigs-pink">✸</span>
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Link to={`/events/${order.event_id}`} className="bg-gigs-pink text-foreground px-6 py-3 font-black uppercase brut-border-2 brut-button text-center hover:bg-gigs-yellow transition-colors">VIEW EVENT →</Link>
          <Link to="/orders" className="bg-foreground text-background px-6 py-3 font-black uppercase brut-border-2 brut-button text-center">ALL ORDERS</Link>
        </div>
      </div>
    </section>
  );
}