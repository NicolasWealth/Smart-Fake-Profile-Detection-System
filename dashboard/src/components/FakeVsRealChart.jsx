import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { cardStyle, theme } from "../lib/dashboardTheme.js"
import EmptyState from "./EmptyState.jsx"

function getCount(scans, label) {
  return scans.filter((scan) => scan.label === label).length
}

function getPercent(count, total) {
  if (!total) {
    return 0
  }

  return Math.round((count / total) * 100)
}

export default function FakeVsRealChart({ scans }) {
  const fakeCount = getCount(scans, "fake")
  const realCount = getCount(scans, "real")
  const total = fakeCount + realCount
  const data = [
    {
      name: "Detections",
      fake: fakeCount,
      real: realCount
    }
  ]

  return (
    <section
      style={{
        ...cardStyle
      }}
    >
      <h2 style={{ marginTop: 0, fontSize: 20, color: theme.text }}>Label split</h2>
      {scans.length === 0 && (
        <div style={{ marginTop: 12 }}>
          <EmptyState title="No scans available" detail="Waiting for labeled scan telemetry." />
        </div>
      )}
      {scans.length > 0 && <div style={{ height: 180, marginTop: 12 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={18}>
            <CartesianGrid stroke={theme.grid} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: theme.muted, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: theme.muted, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: theme.backgroundAlt,
                border: `1px solid ${theme.borderStrong}`,
                borderRadius: 12,
                color: theme.text
              }}
            />
            <Bar dataKey="fake" fill={theme.red} radius={[8, 8, 0, 0]} />
            <Bar dataKey="real" fill={theme.green} radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>}
      <div
        style={{
          marginTop: 16,
          display: "grid",
          gap: 12
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", color: theme.text }}>
          <span>Fake</span>
          <strong>{fakeCount}</strong>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", color: theme.text }}>
          <span>Real</span>
          <strong>{realCount}</strong>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", color: theme.muted }}>
          <span>Total labeled</span>
          <strong>{total}</strong>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", color: theme.muted }}>
          <span>Fake share</span>
          <strong>{getPercent(fakeCount, total)}%</strong>
        </div>
      </div>
    </section>
  )
}
