import { useCallback, useEffect, useState } from "react";
import { Coins, BarChart3, Users, Activity, Ticket, AlertCircle, ArrowDownCircle, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";
import { formatIDR } from "@/lib/format";

const FEATURE_COLORS = ["feature-a", "feature-b", "feature-c", "feature-d", "feature-e", "feature-f"];

export default function AdminAnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/analytics/platform/overview");
      setData(res);
    } catch (err) {
      setError(err.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <section className="py-20 flex justify-center">
        <div className="w-40 h-40 border-4 border-foreground bg-gigs-purple animate-pulse brut-shadow" />
      </section>
    );
  }

  const summary = data?.summary || {};
  const byStatus = data?.byStatus || {};
  const refundBreakdown = data?.refundBreakdown || {};

  const cards = [
    { icon: <Coins className="w-6 h-6 mb-3" />, label: "Total Revenue", value: formatIDR(summary.totalRevenue || 0) },
    { icon: <Ticket className="w-6 h-6 mb-3" />, label: "Total Orders", value: summary.totalOrders ?? 0 },
    { icon: <Activity className="w-6 h-6 mb-3" />, label: "Active Events", value: summary.activeEvents ?? 0 },
    { icon: <Users className="w-6 h-6 mb-3" />, label: "Total Buyers", value: summary.totalBuyers ?? 0 },
    { icon: <BarChart3 className="w-6 h-6 mb-3" />, label: "Platform Revenue", value: formatIDR(summary.platformRevenue || 0) },
    { icon: <ArrowDownCircle className="w-6 h-6 mb-3" />, label: "Refunded Amount", value: formatIDR(summary.refundedAmount || 0) },
    { icon: <RotateCcw className="w-6 h-6 mb-3" />, label: "Refunded Count", value: summary.refundedCount ?? 0 },
  ];

  const statusEntries = Object.entries(byStatus);
  const statusTotal = statusEntries.reduce((sum, [, v]) => sum + (v || 0), 0);

  const refundEntries = Object.entries(refundBreakdown);
  const refundTotal = refundEntries.reduce((sum, [, v]) => sum + (v || 0), 0);

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
        <div className="gigs-card bg-gigs-mint">
          <h2 className="text-xl font-black uppercase tracking-tighter mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" /> Orders by Status
          </h2>
          {statusEntries.length === 0 ? (
            <p className="text-sm font-bold opacity-60">No data</p>
          ) : (
            <div className="flex flex-col gap-3">
              {statusEntries.map(([key, value]) => {
                const pct = statusTotal > 0 ? Math.round((value / statusTotal) * 100) : 0;
                return (
                  <div key={key}>
                    <div className="flex justify-between text-xs font-black uppercase tracking-widest mb-1">
                      <span>{key}</span>
                      <span>{value} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-canvas brut-border-2 h-4">
                      <div
                        className="h-full bg-foreground"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="gigs-card bg-gigs-purple">
          <h2 className="text-xl font-black uppercase tracking-tighter mb-4 flex items-center gap-2">
            <RotateCcw className="w-5 h-5" /> Refund Breakdown
          </h2>
          {refundEntries.length === 0 ? (
            <p className="text-sm font-bold opacity-60">No data</p>
          ) : (
            <div className="flex flex-col gap-3">
              {refundEntries.map(([key, value]) => {
                const pct = refundTotal > 0 ? Math.round((value / refundTotal) * 100) : 0;
                return (
                  <div key={key}>
                    <div className="flex justify-between text-xs font-black uppercase tracking-widest mb-1">
                      <span>{key}</span>
                      <span>{value} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-canvas brut-border-2 h-4">
                      <div
                        className="h-full bg-foreground"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
