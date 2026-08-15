import { formatCompact } from "@/lib/format";

export const CHART_COLORS = [
  "#ff4d8b",
  "#e8b94a",
  "#b8a4ed",
  "#a4d4c5",
  "#ffb084",
  "#1a3a3a",
  "#ff6b5a",
];

export function axisTick(props) {
  const { x, y, payload } = props;
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        dy={12}
        textAnchor="middle"
        fill="#0a0a0a"
        fontSize={10}
        fontWeight={800}
        style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}
      >
        {payload.value}
      </text>
    </g>
  );
}

export function moneyTick(props) {
  const { x, y, payload } = props;
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        dx={-4}
        dy={4}
        textAnchor="end"
        fill="#0a0a0a"
        fontSize={10}
        fontWeight={800}
      >
        {formatCompact(payload.value)}
      </text>
    </g>
  );
}

export function countTick(props) {
  const { x, y, payload } = props;
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        dx={-4}
        dy={4}
        textAnchor="end"
        fill="#0a0a0a"
        fontSize={10}
        fontWeight={800}
      >
        {payload.value}
      </text>
    </g>
  );
}

export function BrutChartTooltip({ active, payload, label, format = null }) {
  if (!active || !payload?.length) return null;
  const fmt = format || ((v) => v);
  return (
    <div className="border-2 border-foreground bg-foreground text-background px-3 py-2">
      {label !== null && label !== undefined && (
        <p className="text-[11px] font-black uppercase tracking-widest mb-1">
          {label}
        </p>
      )}
      {payload.map((entry) => (
        <p
          key={entry.dataKey ?? entry.name}
          className="text-xs font-black uppercase whitespace-nowrap"
        >
          {entry.name}: {fmt(entry.value)}
        </p>
      ))}
    </div>
  );
}

export function ChartCard({ title, icon, children }) {
  return (
    <div className="brut-border-4 bg-canvas p-5 relative">
      <h2 className="text-xl font-black uppercase tracking-tighter mb-4 flex items-center gap-2">
        {icon} {title}
      </h2>
      {children}
    </div>
  );
}