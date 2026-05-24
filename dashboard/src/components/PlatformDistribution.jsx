import { AtSign, Camera, Music2 } from "lucide-react"
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"

import { cardStyle, createBadgeStyle, theme } from "../lib/dashboardTheme.js"
import EmptyState from "./EmptyState.jsx"

const PLATFORMS = [
  { key: "twitter", label: "Twitter", color: theme.cyan, icon: AtSign },
  { key: "instagram", label: "Instagram", color: theme.magenta, icon: Camera },
  { key: "tiktok", label: "TikTok", color: theme.yellow, icon: Music2 }
]

function normalizePlatform(value) {
  const normalized = String(value || "twitter").toLowerCase()
  if (normalized.includes("instagram")) {
    return "instagram"
  }
  if (normalized.includes("tiktok") || normalized.includes("tik tok")) {
    return "tiktok"
  }
  return "twitter"
}

export default function PlatformDistribution({ scans }) {
  const counts = scans.reduce((accumulator, scan) => {
    const platform = normalizePlatform(scan?.platform)
    accumulator[platform] = (accumulator[platform] || 0) + 1
    return accumulator
  }, {})
  const data = PLATFORMS.map((platform) => ({
    ...platform,
    value: counts[platform.key] || 0
  })).filter((platform) => platform.value > 0)

  return (
    <section style={{ ...cardStyle, display: "grid", gap: 16 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 20, color: theme.text }}>Platform distribution</h2>
        <p style={{ marginTop: 8, color: theme.muted }}>
          Scan share across Twitter, Instagram, and TikTok.
        </p>
      </div>

      {data.length === 0 && (
        <EmptyState title="No scans available" detail="Waiting for telemetry from monitored platforms." />
      )}

      {data.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 240px) minmax(0, 1fr)", gap: 16 }}>
          <div style={{ height: 230 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={58}
                  outerRadius={86}
                  paddingAngle={4}
                  stroke="none"
                >
                  {data.map((entry) => (
                    <Cell key={entry.key} fill={entry.color} />
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
          </div>

          <div style={{ display: "grid", gap: 10, alignContent: "center" }}>
            {PLATFORMS.map(({ key, label, color, icon: Icon }) => (
              <div
                key={key}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  padding: 12,
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.035)",
                  border: `1px solid ${color}22`
                }}
              >
                <span style={createBadgeStyle(color)}>
                  <Icon size={14} /> {label}
                </span>
                <strong style={{ color: theme.text }}>{counts[key] || 0}</strong>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
