import { useCallback, useEffect, useState } from "react";
import { Coins, BarChart3, Users, Activity, Ticket, AlertCircle, ArrowDownCircle, RotateCcw, CalendarOff } from "lucide-react";
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
import { formatIDR } from "@/lib/format";
import { CHART_COLORS, axisTick, countTick, BrutChartTooltip, ChartCard } from "@/components/ui/chart";

const FEATURE_COLORS = ["feature-a", "feature-b", "feature-c", "feature-d", "feature-e", "feature-f"];

const STATUS_LABELS = {
  awaiting_payment: "Awaiting Payment",
  pending: "Pending",
  holding_period: "Holding Period",
  released: "Released",
  held: "Held",
  refunded: "Refunded",
  expired: "Expired",
};

export default function AdminAnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    return api.get("/analytics/platform/overview");
  }, []);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((res) => {
        if (cancelled) return;
        setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load analytics");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  if (loading) {
    return (
      <section className="py-20 flex justify-center">
        <div className="w-40 h-40 border-4 border-foreground bg-gigs-purple animate-pulse brut-shadow" />
      </section>
    );
  }

  const revenue = data?.revenue || {};
  const refunded = data?.refunded || {};
  const byStatus = Array.isArray(data?.byStatus) ? data.byStatus : [];
  const events = data?.events || {};
  const buyers = data?.buyers || 0;
  const platformRevenueBalance = data?.platformRevenueBalance || 0;

  const statusData = byStatus.map((s) => ({
    name: STATUS_LABELS[s.status] || s.status,
    value: s.count || 0,
  }));

  const refundData = [
    { name: "Event Cancelled", value: refunded.eventCancelled || 0 },
    { name: "Admin Override", value: refunded.adminOverride || 0 },
  ].filter((r) => r.value > 0);

  const buyRate = revenue.count > 0 ? Math.round((buyers / revenue.count) * 100) : 0;

  const cards = [
    { icon: <Coins className="w-6 h-6 mb-3" />, label: "Total Revenue", value: formatIDR(revenue.gross || 0) },
    { icon: <Ticket className="w-6 h-6 mb-3" />, label: "Total Orders", value: revenue.count ?? 0 },
    { icon: <Activity className="w-6 h-6 mb-3" />, label: "Published Events", value: events.published ?? 0 },
    { icon: <Users className="w-6 h-6 mb-3" />, label: "Total Buyers", value: buyers },
    { icon: <BarChart3 className="w-6 h-6 mb-3" />, label: "Platform Revenue", value: formatIDR(platformRevenueBalance) },
    { icon: <ArrowDownCircle className="w-6 h-6 mb-3" />, label: "Refunded Amount", value: formatIDR(refunded.amount || 0) },
    { icon: <RotateCcw className="w-6 h-6 mb-3" />, label: "Refunded Orders", value: refunded.count ?? 0 },
    { icon: <CalendarOff className="w-6 h-6 mb-3" />, label: "Cancelled Events", value: events.cancelled ?? 0 },
  ];

  return (
    <section className="py-4">
      <div className="mb-10">
        <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-2 flex items-center gap-4">
          PLATFORM <span className="bg-foreground text-background px-2 brut-shadow -rotate-2 inline-block">ANALYTICS</span>
        </h1>
        <p className="font-bold text-lg">High-level overview of platform health.</p>
      </div>

      {error && (
        <div className="gigs-card bg-error text-background mb-8">
          <p className="font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {cards.map((c, i) => (
          <div key={c.label} className={`gigs-card ${FEATURE_COLORS[i % FEATURE_COLORS.length]}`}>
            {c.icon}
            <p className="text-sm font-black uppercase tracking-widest opacity-80">{c.label}</p>
            <p className="font-black text-3xl mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Orders by Status" icon={<BarChart3 className="w-5 h-5" />}>
          {statusData.length === 0 ? (
            <p className="text-sm font-bold opacity-60">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={statusData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#0a0a0a" opacity={0.25} />
                <XAxis dataKey="name" tick={axisTick} interval={0} />
                <YAxis tick={countTick} width={60} />
                <Tooltip content={<BrutChartTooltip />} />
                <Bar dataKey="value" name="Orders" radius={0}>
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="#0a0a0a" strokeWidth={2} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Refund Breakdown" icon={<RotateCcw className="w-5 h-5" />}>
          {refundData.length === 0 ? (
            <p className="text-sm font-bold opacity-60">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={refundData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  innerRadius={50}
                  stroke="#0a0a0a"
                  strokeWidth={2}
                >
                  {refundData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<BrutChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <p className="mt-6 text-xs font-black uppercase tracking-widest opacity-60">
        Repeat-buyer rate: {buyRate}% ({buyers} buyers / {revenue.count} paid orders) — ledger platform balance: {formatIDR(platformRevenueBalance)}
      </p>
    </section>
  );
}