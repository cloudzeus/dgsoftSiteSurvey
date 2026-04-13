"use client"

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from "recharts"

interface DataPoint {
  label: string
  successRate: number
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const val = payload[0]?.value ?? 0
  const color = val >= 95 ? "#16a34a" : val >= 70 ? "#d97706" : "#dc2626"
  return (
    <div
      className="rounded-lg px-3 py-2.5 text-[12px]"
      style={{
        background: "#0e0f11",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
        color: "white",
      }}
    >
      <p className="font-semibold mb-1" style={{ color: "rgba(255,255,255,0.7)" }}>{label}</p>
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full flex-shrink-0" style={{ background: color }} />
        <span style={{ color: "rgba(255,255,255,0.5)" }}>Success rate:</span>
        <span className="font-semibold" style={{ color }}>{val}%</span>
      </div>
    </div>
  )
}

export function SuccessRateChart({ data }: { data: DataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
        <defs>
          <linearGradient id="successGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "var(--foreground-subtle)" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: "var(--foreground-subtle)" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: "var(--border)", strokeWidth: 1 }} />
        <ReferenceLine
          y={95}
          stroke="#d97706"
          strokeDasharray="4 3"
          strokeWidth={1}
          label={{ value: "95%", fontSize: 9, fill: "#d97706", position: "right" }}
        />
        <Area
          type="monotone"
          dataKey="successRate"
          stroke="#4f46e5"
          strokeWidth={2}
          fill="url(#successGradient)"
          dot={{ r: 2.5, fill: "#4f46e5", strokeWidth: 0 }}
          activeDot={{ r: 4, fill: "#4f46e5", strokeWidth: 2, stroke: "#fff" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
