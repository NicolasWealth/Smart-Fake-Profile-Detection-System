import { useMemo, useState } from "react"
import { Activity, Waves } from "lucide-react"
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts"

import { cardStyle, createBadgeStyle, getProbabilityValue, getRiskTone, theme } from "../lib/dashboardTheme.js"
import EmptyState from "./EmptyState.jsx"

function getBucketKey(date, grouping) {
  const copy = new Date(date)

  if (grouping === "daily") {
    copy.setHours(0, 0, 0, 0)
  } else {
    copy.setMinutes(0, 0, 0)
  }

  return copy.toISOString()
}

function formatBucket(key, grouping) {
  const date = new Date(key)
  return date.toLocaleString([], grouping === "daily"
    ? { month: "short", day: "numeric" }
    : { hour: "2-digit", minute: "2-digit" })
}

function buildTimeline(scans, grouping) {
  const buckets = new Map()

  scans.forEach((scan) => {
    const timestamp = Date.parse(scan?.created_at)
    if (!Number.isFinite(timestamp)) {
      return
    }

    const key = getBucketKey(timestamp, grouping)
    const current = buckets.get(key) || {
      key,
      slot: formatBucket(key, grouping),
      scans: 0,
      highRisk: 0,
      mediumRisk: 0,
      riskTotal: 0
    }
    const probability = getProbabilityValue(scan)
    const tone = getRiskTone(probability, undefined, scan?.label)

    current.scans += 1
    current.riskTotal += probability
    if (tone.label === "HIGH") {
      current.highRisk += 1
    }
    if (tone.label === "MEDIUM") {
      current.mediumRisk += 1
    }

    buckets.set(key, current)
  })

  return [...buckets.values()]
    .sort((left, right) => Date.parse(left.key) - Date.parse(right.key))
    .slice(-24)
    .map((bucket) => {
      const averageRisk = bucket.scans ? Math.round(bucket.riskTotal / bucket.scans) : 0
      const burst = bucket.highRisk >= 3 || bucket.highRisk / Math.max(bucket.scans, 1) >= 0.5

      return {
        ...bucket,
        averageRisk,
        burst: burst ? bucket.highRisk : 0,
        wave: bucket.highRisk + bucket.mediumRisk
      }
    })
}

export default function ScanTimelineChart({ scans }) {
  const [grouping, setGrouping] = useState("hourly")
  const data = useMemo(() => buildTimeline(scans, grouping), [scans, grouping])
  const highRiskBursts = data.filter((bucket) => bucket.burst > 0).length
  const suspiciousWaves = data.filter((bucket) => bucket.wave >= 3).length

  return (
    <section style={{ ...cardStyle, display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, color: theme.text }}>Scan timeline analytics</h2>
          <p style={{ marginTop: 8, color: theme.muted }}>
            Scan volume, high risk bursts, and suspicious activity waves.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["hourly", "daily"].map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setGrouping(option)}
              style={{
                ...createBadgeStyle(grouping === option ? theme.cyan : theme.gray),
                cursor: "pointer",
                background: grouping === option ? `${theme.cyan}1f` : "rgba(255,255,255,0.03)"
              }}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 && (
        <EmptyState title="No scans available" detail="Waiting for telemetry to build timeline analytics." />
      )}

      {data.length > 0 && (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span style={createBadgeStyle(highRiskBursts ? theme.red : theme.green)}>
              <Activity size={14} /> {highRiskBursts ? `${highRiskBursts} high risk bursts` : "No threat activity detected"}
            </span>
            <span style={createBadgeStyle(suspiciousWaves ? theme.orange : theme.gray)}>
              <Waves size={14} /> {suspiciousWaves} suspicious waves
            </span>
          </div>

          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={theme.grid} vertical={false} />
                <XAxis dataKey="slot" tick={{ fill: theme.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="count" tick={{ fill: theme.muted, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis yAxisId="risk" orientation="right" domain={[0, 100]} tick={{ fill: theme.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: theme.backgroundAlt,
                    border: `1px solid ${theme.borderStrong}`,
                    borderRadius: 12,
                    color: theme.text
                  }}
                />
                <Bar yAxisId="count" dataKey="scans" name="Scans" fill={theme.cyan} radius={[8, 8, 0, 0]} />
                <Bar yAxisId="count" dataKey="burst" name="High risk burst" fill={theme.red} radius={[8, 8, 0, 0]} />
                <Line yAxisId="risk" type="monotone" dataKey="averageRisk" name="Average risk" stroke={theme.orange} strokeWidth={3} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </section>
  )
}
