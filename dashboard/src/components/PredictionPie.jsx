import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"

import { cardStyle, theme } from "../lib/dashboardTheme.js"
import EmptyState from "./EmptyState.jsx"

export default function PredictionPie({ scans }) {
  const fakeCount = scans.filter((scan) => scan.label === "fake").length
  const realCount = scans.filter((scan) => scan.label === "real").length
  const data = [
    { name: "Fake", value: fakeCount, color: theme.red },
    { name: "Real", value: realCount, color: theme.green }
  ].filter((entry) => entry.value > 0)

  return (
    <section
      style={{
        ...cardStyle
      }}
    >
      <h2 style={{ marginTop: 0, fontSize: 20, color: theme.text }}>Prediction share</h2>
      {scans.length === 0 && (
        <div style={{ marginTop: 12 }}>
          <EmptyState title="No scans available" detail="Waiting for telemetry before drawing prediction share." />
        </div>
      )}
      {scans.length > 0 && <div style={{ height: 220, marginTop: 12 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data.length ? data : [{ name: "No Data", value: 1, color: theme.subtle }]}
              dataKey="value"
              innerRadius={58}
              outerRadius={82}
              paddingAngle={4}
              stroke="none"
            >
              {(data.length ? data : [{ color: theme.subtle }]).map((entry) => (
                <Cell key={entry.color} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: theme.backgroundAlt,
                border: `1px solid ${theme.borderStrong}`,
                borderRadius: 12,
                color: theme.text
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: theme.muted }}>
        <span>Fake: {fakeCount}</span>
        <span>Real: {realCount}</span>
        <span>Total: {scans.length}</span>
      </div>
    </section>
  )
}
