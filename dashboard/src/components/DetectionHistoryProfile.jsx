import { History, Repeat2, TrendingUp } from "lucide-react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts"

import {
  cardStyle,
  createBadgeStyle,
  formatTimestamp,
  getConfidenceValue,
  getProbabilityValue,
  getRiskTone,
  theme
} from "../lib/dashboardTheme.js"
import EmptyState from "./EmptyState.jsx"

function sameProfile(left, right) {
  return (
    String(left?.username || "").toLowerCase() === String(right?.username || "").toLowerCase() &&
    String(left?.platform || "twitter").toLowerCase() === String(right?.platform || "twitter").toLowerCase()
  )
}

function buildHistory(scans, selectedScan) {
  if (!selectedScan) {
    return []
  }

  return [...scans]
    .filter((scan) => sameProfile(scan, selectedScan))
    .sort((left, right) => (Date.parse(left.created_at) || 0) - (Date.parse(right.created_at) || 0))
}

export default function DetectionHistoryProfile({ scans, selectedScan }) {
  const history = buildHistory(scans, selectedScan)
  const latest = history.at(-1)
  const repeatedDetections = Math.max(history.length - 1, 0)
  const trendData = history.map((scan, index) => {
    const confidence = getConfidenceValue(scan)
    const probability = getProbabilityValue(scan)
    const tone = getRiskTone(probability, confidence, scan.risk_level || scan.risk_code || scan.label)

    return {
      slot: formatTimestamp(scan.created_at, { hour: "2-digit", minute: "2-digit" }) || `S${index + 1}`,
      confidence,
      risk: probability,
      label: tone.label
    }
  })
  const latestConfidence = getConfidenceValue(latest)
  const latestTone = getRiskTone(
    getProbabilityValue(latest),
    latestConfidence,
    latest?.risk_level || latest?.risk_code || latest?.label
  )

  return (
    <section style={{ ...cardStyle, display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, color: theme.text }}>Detection History</h2>
          <p style={{ margin: "6px 0 0", color: theme.muted }}>
            Repeated detections, confidence trend, and risk evolution for the selected profile.
          </p>
        </div>
        <span style={createBadgeStyle(latestTone.color)}>{latestTone.label}</span>
      </div>

      {!selectedScan && <EmptyState title="No profile selected" detail="Select a scan to inspect detection history." />}

      {selectedScan && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            <Metric icon={History} label="Historical scans" value={history.length} color={theme.cyan} />
            <Metric icon={Repeat2} label="Repeated detections" value={repeatedDetections} color={theme.amber} />
            <Metric icon={TrendingUp} label="Current confidence" value={`${latestConfidence}%`} color={latestTone.color} />
          </div>

          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid stroke={theme.grid} vertical={false} />
                <XAxis dataKey="slot" tick={{ fill: theme.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: theme.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: theme.backgroundAlt,
                    border: `1px solid ${theme.borderStrong}`,
                    borderRadius: 12,
                    color: theme.text
                  }}
                />
                <Line type="monotone" dataKey="risk" name="Risk" stroke={theme.red} strokeWidth={3} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="confidence" name="Confidence" stroke={theme.cyan} strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            {history.slice(-4).reverse().map((scan) => {
              const confidence = getConfidenceValue(scan)
              const probability = getProbabilityValue(scan)
              const tone = getRiskTone(probability, confidence, scan.risk_level || scan.risk_code || scan.label)

              return (
                <div
                  key={scan.id ?? `${scan.username}-${scan.created_at}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(110px, 1fr) 110px 120px",
                    gap: 10,
                    color: theme.text,
                    borderTop: `1px solid ${theme.grid}`,
                    paddingTop: 9
                  }}
                >
                  <span>{formatTimestamp(scan.created_at)}</span>
                  <span>{confidence}%</span>
                  <span style={{ color: tone.color }}>{tone.label}</span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}

function Metric({ icon: Icon, label, value, color }) {
  return (
    <div style={{ padding: 14, borderRadius: 14, background: "rgba(255,255,255,0.04)", border: `1px solid ${theme.border}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: theme.muted, fontSize: 12, textTransform: "uppercase" }}>
        <Icon size={14} color={color} />
        {label}
      </div>
      <div style={{ marginTop: 8, color, fontSize: 24, fontWeight: 800 }}>{value}</div>
    </div>
  )
}
