import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Ticket, Coins } from "lucide-react";
import { api } from "@/lib/api";
import { formatIDR, formatEventDate } from "@/lib/format";

const STATUS_STYLES = {
  awaiting_payment: { label: "AWAITING PAYMENT", cls: "bg-gigs-yellow text-foreground border-foreground" },
  pending: { label: "CONFIRMED", cls: "bg-gigs-teal text-ink border-foreground" },
  holding_period: { label: "HOLDING PERIOD", cls: "bg-gigs-purple text-ink border-foreground" },
  released: { label: "RELEASED", cls: "bg-gigs-teal text-ink border-foreground" },
  held: { label: "HELD", cls: "bg-gigs-orange text-ink border-foreground" },
  refunded: { label: "REFUNDED", cls: "bg-error text-background border-foreground" },
  expired: { label: "EXPIRED", cls: "bg-canvas text-foreground/60 border-foreground" },
};

const statusBadge = (status) => {
  const s = STATUS_STYLES[status] || { label: status, cls: "bg-canvas text-ink border-foreground" };
  return (
    <span className={`inline-flex items-center rounded-none px-2 py-1 font-black uppercase tracking-widest text-xs brut-border-2 ${s.cls}`}>
      {s.label}
    </span>
  );
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    return api.get("/admin/orders");
  }, []);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => {
        if (cancelled) return;
        setOrders(data.orders || []);
        setError("");
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load orders");
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
      setOrders(data.orders || []);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load orders");
    }
  }, [load]);

  const override = async (id, status) => {
    setError("");
    try {
      await api.post(`/admin/orders/${id}/override`, { status });
      await refresh();
    } catch (err) {
      setError(err.message || `Override to ${status} failed`);
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
          ORDER <span className="bg-foreground text-background px-2 brut-shadow -rotate-2 inline-block">OVERRIDE</span>
        </h1>
        <p className="font-bold text-lg">Review and manually intervene on orders.</p>
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
              <th className="py-3 px-3 text-xs font-black uppercase tracking-widest whitespace-nowrap">Buyer</th>
              <th className="py-3 px-3 text-xs font-black uppercase tracking-widest whitespace-nowrap">Event</th>
              <th className="py-3 px-3 text-xs font-black uppercase tracking-widest whitespace-nowrap">Category</th>
              <th className="py-3 px-3 text-xs font-black uppercase tracking-widest whitespace-nowrap">Amount</th>
              <th className="py-3 px-3 text-xs font-black uppercase tracking-widest whitespace-nowrap">Status</th>
              <th className="py-3 px-3 text-xs font-black uppercase tracking-widest whitespace-nowrap">Holding Until</th>
              <th className="py-3 px-3 text-xs font-black uppercase tracking-widest whitespace-nowrap text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="py-16 text-center text-sm text-foreground opacity-50 font-bold uppercase">
                  No orders found
                </td>
              </tr>
            )}
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-foreground hover:bg-gigs-ochre/20 transition-colors">
                <td className="py-3 px-3 whitespace-nowrap">
                  <p className="font-bold text-sm text-foreground">{o.buyer_name || "—"}</p>
                  <p className="text-xs text-foreground opacity-60">{o.buyer_email || "—"}</p>
                </td>
                <td className="py-3 px-3 whitespace-nowrap">
                  <Link to={`/events/${o.event_id}`} className="font-bold text-sm text-foreground hover:text-gigs-pink transition-colors">
                    {o.event_title || "—"}
                  </Link>
                </td>
                <td className="py-3 px-3 whitespace-nowrap font-bold text-sm">
                  <span className="flex items-center gap-1">
                    <Ticket className="w-4 h-4 opacity-60" />
                    {o.category_name || "—"}
                  </span>
                </td>
                <td className="py-3 px-3 whitespace-nowrap font-black text-sm">
                  <span className="flex items-center gap-1">
                    <Coins className="w-4 h-4 opacity-60" />
                    {formatIDR(o.amount || 0)}
                  </span>
                </td>
                <td className="py-3 px-3 whitespace-nowrap">{statusBadge(o.status)}</td>
                <td className="py-3 px-3 whitespace-nowrap text-xs font-bold text-foreground opacity-70">
                  {o.holding_until ? formatEventDate(o.holding_until) : "—"}
                </td>
                <td className="py-3 px-3 whitespace-nowrap text-right">
                  {o.status === "holding_period" && (
                    <div className="inline-flex flex-wrap gap-2 justify-end">
                      <button
                        type="button"
                        data-testid={`admin-hold-${o.id}`}
                        onClick={() => override(o.id, "held")}
                        className="inline-flex items-center gap-1 bg-gigs-orange text-ink px-3 py-1 font-black uppercase text-xs brut-border-2 brut-button"
                      >
                        Hold
                      </button>
                      <button
                        type="button"
                        data-testid={`admin-refund-${o.id}`}
                        onClick={() => override(o.id, "refunded")}
                        className="inline-flex items-center gap-1 bg-error text-background px-3 py-1 font-black uppercase text-xs brut-border-2 brut-button"
                      >
                        Refund
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
