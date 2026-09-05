import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Coins, Calendar, Ticket, User, BarChart3, PieChart as PieIcon } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "@/lib/api";
import { formatIDR, formatEventDate } from "@/lib/format";
import { CHART_COLORS, axisTick, moneyTick, BrutChartTooltip, ChartCard } from "@/components/ui/chart";

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

const REFUND_REASON_LABEL = {
  event_cancelled: "EVENT CANCELLED BY THE ORGANIZER",
  admin_override: "ADMIN PUTUSAN",
};

const statusBadgeWithReason = (status, reason) => {
  return (
    <span>
      {statusBadge(status)}
      {status === "refunded" && reason && (
        <span className="ml-2 inline-block text-xs font-black uppercase tracking-widest text-foreground/60">{REFUND_REASON_LABEL[reason] || reason}</span>
      )}
    </span>
  );
};

export default function EventOrdersPage() {
  const { id } = useParams();

  const [event, setEvent] = useState(null);
  const [orders, setOrders] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    const [eventData, ordersData, analyticsData] = await Promise.all([
      api.get(`/events/${id}`),
      api.get(`/events/${id}/orders`),
      api.get(`/analytics/event/${id}/overview`),
    ]);
    return {
      event: eventData.event,
      orders: ordersData.orders || [],
      analytics: analyticsData,
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    fetchData()
      .then((data) => {
        if (cancelled) return;
        setEvent(data.event);
        setOrders(data.orders);
        setAnalytics(data.analytics);
        setError("");
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load orders & funds");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [fetchData]);

  if (loading) {
    return (
      <section className="py-20 flex justify-center">
        <div className="w-40 h-40 border-4 border-foreground bg-gigs-purple animate-pulse brut-shadow" />
      </section>
    );
  }

  const summary = analytics?.summary || {};
  const fund = analytics?.fundStatus || {};
  const perCategory = analytics?.perCategory || [];

  const revenueData = perCategory.map((c) => ({
    name: c.name || "—",
    revenue: c.sold_amount || 0,
    sold: c.sold_count || 0,
    quota: c.quota || 0,
  }));

  const statusData = [
    { name: "Sold", value: summary.ticketsSold || 0 },
    { name: "Awaiting", value: summary.awaitingCount || 0 },
    { name: "Held", value: summary.heldCount || 0 },
    { name: "Refunded", value: summary.refundedCount || 0 },
    { name: "Expired", value: summary.expiredCount || 0 },
  ].filter((s) => s.value > 0);

  return (
    <section className="py-4">
      <nav className="mb-8 font-bold uppercase text-sm">
        <Link to="/organizer/events" className="hover:text-gigs-pink transition-colors">
          ← MY EVENTS
        </Link>
      </nav>

      <div className="mb-10">
        <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-2 flex items-center gap-4 flex-wrap">
          <span className="bg-foreground text-background px-2 brut-shadow -rotate-2 inline-block">ORDERS</span>
        </h1>
        {event && (
          <p className="text-xl font-bold text-foreground opacity-80 flex items-center gap-2 uppercase">
            <Calendar className="w-5 h-5" /> {event.title}
          </p>
        )}
      </div>

      {error && (
        <div className="gigs-card bg-error text-background mb-8">
          <p className="font-bold">{error}</p>
        </div>
      )}

      {/* Overview analytics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div className="gigs-card feature-a">
          <Coins className="w-6 h-6 text-background mb-3" />
          <p className="text-sm font-black uppercase tracking-widest text-background opacity-80">Total Revenue</p>
          <p className="font-black text-3xl mt-1 text-background">{formatIDR(summary.revenue || 0)}</p>
        </div>
        <div className="gigs-card feature-d">
          <Coins className="w-6 h-6 text-foreground mb-3" />
          <p className="text-sm font-black uppercase tracking-widest text-foreground opacity-80">Net Revenue</p>
          <p className="font-black text-3xl mt-1 text-foreground">{formatIDR(summary.netRevenue || 0)}</p>
        </div>
        <div className="gigs-card feature-e">
          <Ticket className="w-6 h-6 text-foreground mb-3" />
          <p className="text-sm font-black uppercase tracking-widest text-foreground opacity-80">Tickets Sold</p>
          <p className="font-black text-3xl mt-1 text-foreground">{summary.ticketsSold || 0}</p>
        </div>
        <div className="gigs-card feature-b">
          <Coins className="w-6 h-6 text-ink mb-3" />
          <p className="text-sm font-black uppercase tracking-widest text-ink opacity-80">Available Funds</p>
          <p className="font-black text-3xl mt-1 text-ink">{formatIDR(fund.available || 0)}</p>
        </div>
      </div>

      {/* Status breakdown */}
      <div className="gigs-card bg-gigs-mint mb-10">
        <h2 className="text-xl font-black uppercase tracking-tighter mb-4 flex items-center gap-2">
          <User className="w-5 h-5" /> Order Breakdown
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {[
            { label: "Sold", value: summary.ticketsSold || 0 },
            { label: "Awaiting", value: summary.awaitingCount || 0 },
            { label: "Held", value: summary.heldCount || 0 },
            { label: "Refunded", value: summary.refundedCount || 0 },
            { label: "Expired", value: summary.expiredCount || 0 },
          ].map((s) => (
            <div key={s.label} className="brut-border-2 p-3 bg-canvas" style={{ border: "2px solid #0a0a0a" }}>
              <p className="font-black text-2xl text-foreground">{s.value}</p>
              <p className="text-xs font-black uppercase tracking-widest text-foreground opacity-60">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        <ChartCard title="Revenue by Category" icon={<BarChart3 className="w-5 h-5" />}>
          {revenueData.length === 0 ? (
            <p className="text-sm font-bold opacity-60">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={revenueData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#0a0a0a" opacity={0.25} />
                <XAxis dataKey="name" tick={axisTick} interval={0} />
                <YAxis tick={moneyTick} width={70} />
                <Tooltip content={<BrutChartTooltip format={formatIDR} />} />
                <Bar dataKey="revenue" name="Revenue" radius={0}>
                  {revenueData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="#0a0a0a" strokeWidth={2} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Order Status" icon={<PieIcon className="w-5 h-5" />}>
          {statusData.length === 0 ? (
            <p className="text-sm font-bold opacity-60">No data</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    innerRadius={50}
                    stroke="#0a0a0a"
                    strokeWidth={2}
                  >
                    {statusData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="#0a0a0a" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip content={<BrutChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 flex flex-wrap gap-2">
                {statusData.map((s, i) => (
                  <span key={s.name} className="inline-flex items-center gap-2 border-2 border-foreground bg-canvas px-2 py-1 text-xs font-black uppercase tracking-widest">
                    <span
                      className="inline-block w-3 h-3 border-2 border-foreground"
                      style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                    {s.name} ({s.value})
                  </span>
                ))}
              </div>
            </>
          )}
        </ChartCard>
      </div>

      {/* Orders table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b-4 border-foreground">
              <th className="py-3 px-3 text-xs font-black uppercase tracking-widest whitespace-nowrap">Buyer</th>
              <th className="py-3 px-3 text-xs font-black uppercase tracking-widest whitespace-nowrap">Category</th>
              <th className="py-3 px-3 text-xs font-black uppercase tracking-widest whitespace-nowrap">Amount</th>
              <th className="py-3 px-3 text-xs font-black uppercase tracking-widest whitespace-nowrap">Status</th>
              <th className="py-3 px-3 text-xs font-black uppercase tracking-widest whitespace-nowrap">Paid</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr>
                <td colSpan={5} className="py-16 text-center text-sm text-foreground opacity-50 font-bold uppercase">
                  No orders yet
                </td>
              </tr>
            )}
            {orders.map((o) => (
              <tr
                key={o.id}
                className="border-b border-foreground hover:bg-gigs-ochre/20 transition-colors"
              >
                <td className="py-3 px-3 whitespace-nowrap">
                  <p className="font-bold text-sm text-foreground">{o.buyer_name || "—"}</p>
                  <p className="text-xs text-foreground opacity-60">{o.buyer_email || "—"}</p>
                </td>
                <td className="py-3 px-3 whitespace-nowrap font-bold text-sm">{o.category_name || "—"}</td>
                <td className="py-3 px-3 whitespace-nowrap font-black text-sm">
                  {formatIDR(o.amount || 0)}
                </td>
                <td className="py-3 px-3 whitespace-nowrap">{statusBadgeWithReason(o.status, o.refund_reason)}</td>
                <td className="py-3 px-3 whitespace-nowrap text-xs font-bold text-foreground opacity-70">
                  {o.paid_at ? formatEventDate(o.paid_at) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
