import { BarChart3 } from "lucide-react"

import {
  cardStyle,
  createBadgeStyle,
  getConfidenceValue,
  getProbabilityValue,
  theme
} from "../lib/dashboardTheme.js"
import EmptyState from "./EmptyState.jsx"

function normalizePlatform(platform) {
  return String(platform || "unknown").toLowerCase()
}

function buildPlatformRows(scans) {
  const rows = new Map()

  scans.forEach((scan) => {
    const platform = normalizePlatform(scan.platform)
    const current = rows.get(platform) || {
      platform,
      scans: 0,
      highRisk: 0,
      confidenceTotal: 0
    }

    current.scans += 1
    current.confidenceTotal += getConfidenceValue(scan)

    if (getProbabilityValue(scan) >= 70) {
      current.highRisk += 1
    }

    rows.set(platform, current)
  })

  return [...rows.values()]
    .map((row) => ({
      ...row,
      averageConfidence: row.scans
        ? Math.round(row.confidenceTotal / row.scans)
        : 0
    }))
    .sort((left, right) => right.scans - left.scans)
}

export default function PlatformOverview({ scans }) {
  const rows = buildPlatformRows(scans)

  return (
    <section style={{ ...cardStyle, display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, color: theme.text }}>Platform Intelligence</h2>
          <p style={{ margin: "6px 0 0", color: theme.muted }}>
            Scan volume, high-risk detections, and confidence by platform.
          </p>
        </div>
        <BarChart3 size={20} color={theme.cyan} />
      </div>

      {rows.length === 0 && (
        <EmptyState title="No platform activity" detail="Waiting for scans from Twitter, Instagram, or connected platforms." />
      )}

      {rows.length > 0 && (
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map((row, index) => {
            const color = [theme.cyan, theme.magenta, theme.green, theme.amber][index % 4]
            const highRiskRate = row.scans
              ? Math.round((row.highRisk / row.scans) * 100)
              : 0

            return (
              <div
                key={row.platform}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(120px, 1fr) repeat(3, minmax(90px, auto))",
                  gap: 12,
                  alignItems: "center",
                  padding: 12,
                  borderRadius: 14,
                  border: `1px solid ${theme.border}`,
                  background: "rgba(255,255,255,0.035)"
                }}
              >
                <span style={createBadgeStyle(color)}>{row.platform}</span>
                <Metric label="Scans" value={row.scans} />
                <Metric label="High-risk" value={`${row.highRisk} (${highRiskRate}%)`} />
                <Metric label="Confidence" value={`${row.averageConfidence}%`} />
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function Metric({ label, value }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ color: theme.muted, fontSize: 11, textTransform: "uppercase" }}>{label}</div>
      <div style={{ color: theme.text, fontWeight: 800 }}>{value}</div>
    </div>
  )
}
