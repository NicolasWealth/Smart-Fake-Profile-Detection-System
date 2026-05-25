import { motion } from "framer-motion"
import { Activity, Radar, ShieldAlert } from "lucide-react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts"

import {
  cardStyle,
  createBadgeStyle,
  formatTimestamp,
  getConfidenceBand,
  getConfidenceValue,
  getProbabilityValue,
  getRiskTone,
  theme
} from "../lib/dashboardTheme.js"

function getRowKey(scan) {
  return scan?.id ?? `${scan?.username ?? "unknown"}-${scan?.created_at ?? "pending"}`
}

function buildTrendData(scans) {
  return [...scans]
    .slice(0, 12)
    .reverse()
    .map((scan, index) => ({
      slot: formatTimestamp(scan.created_at, { hour: "2-digit", minute: "2-digit" }) || `T${index + 1}`,
      risk: getProbabilityValue(scan),
      confidence: getConfidenceValue(scan)
    }))
}

function buildSpikeData(scans) {
  const latest = scans.slice(0, 20)
  const windows = []

  for (let index = 0; index < latest.length; index += 5) {
    const chunk = latest.slice(index, index + 5)
    const highSeverity = chunk.filter((scan) => getProbabilityValue(scan) >= 70).length
    const label = chunk.at(-1)?.created_at
      ? formatTimestamp(chunk.at(-1).created_at, { hour: "2-digit", minute: "2-digit" })
      : `W${windows.length + 1}`

    windows.push({
      window: label,
      spikes: highSeverity
    })
  }

  return windows.reverse()
}

function buildPlatformDistribution(scans) {
  const counts = scans.reduce((accumulator, scan) => {
    const platform = (scan.platform || "twitter").toLowerCase()
    accumulator[platform] = (accumulator[platform] || 0) + 1
    return accumulator
  }, {})

  return Object.entries(counts).map(([platform, total], index) => ({
    platform,
    total,
    color: [theme.cyan, theme.blue, theme.magenta, theme.green][index % 4]
  }))
}

export default function ThreatFeed({ scans, selectedScanKey, onSelect }) {
  const latestScans = scans.slice(0, 8)
  const trendData = buildTrendData(scans)
  const spikeData = buildSpikeData(scans)
  const platformData = buildPlatformDistribution(scans)

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.02 }}
      style={{
        ...cardStyle,
        display: "grid",
        gap: 20
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: theme.red,
                boxShadow: `0 0 0 6px ${theme.red}22`
              }}
            />
            <span style={{ color: theme.red, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em" }}>
              Live monitoring
            </span>
          </div>
          <h2 style={{ margin: "12px 0 0", fontSize: 24, color: theme.text }}>Threat feed</h2>
          <p style={{ marginTop: 8, color: theme.muted }}>
            Latest scans, severity distribution, timeline spikes, and platform coverage.
          </p>
        </div>
        <div style={{ color: theme.muted, textAlign: "right", fontSize: 13 }}>
          <div>{scans.length} total ingested scans</div>
          <div>{scans.filter((scan) => getProbabilityValue(scan) >= 70).length} high-severity signals</div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 18,
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))"
        }}
      >
        <div
          style={{
            borderRadius: 18,
            border: `1px solid ${theme.border}`,
            background: "rgba(3, 10, 18, 0.76)",
            padding: 18
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <ShieldAlert size={16} color={theme.red} />
            <span style={{ color: theme.text, fontWeight: 700 }}>Terminal feed</span>
          </div>
          <div style={{ display: "grid", gap: 10, fontFamily: "Cascadia Code, Consolas, monospace" }}>
            {latestScans.map((scan) => {
              const rowKey = getRowKey(scan)
              const probability = getProbabilityValue(scan)
              const confidence = getConfidenceValue(scan)
              const tone = getRiskTone(probability, confidence, scan.risk_level || scan.risk_code || scan.label)
              const confidenceBand = scan.confidence_band || getConfidenceBand(confidence)
              const isSelected = rowKey === selectedScanKey

              return (
                <button
                  key={rowKey}
                  onClick={() => onSelect(rowKey)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(140px, 1.2fr) 80px 140px minmax(0, 1fr) 110px",
                    gap: 10,
                    alignItems: "center",
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: 14,
                    border: `1px solid ${isSelected ? tone.color : theme.border}`,
                    background: isSelected ? `${tone.color}14` : "rgba(255,255,255,0.02)",
                    color: theme.text,
                    textAlign: "left",
                    cursor: "pointer"
                  }}
                >
                  <span style={{ color: tone.color, fontWeight: 700 }}>{tone.label}</span>
                  <span style={{ color: theme.muted }}>{scan.platform || "twitter"}</span>
                  <span style={{ color: theme.text }}>{confidenceBand}</span>
                  <span style={{ color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    @{scan.username || "unknown"}
                  </span>
                  <span style={{ color: theme.subtle, fontSize: 12 }}>
                    {formatTimestamp(scan.created_at, { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </button>
              )
            })}
            {latestScans.length === 0 && (
              <div style={{ color: theme.muted }}>No scans available. Waiting for telemetry...</div>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <div
            style={{
              borderRadius: 18,
              border: `1px solid ${theme.border}`,
              background: "rgba(255,255,255,0.03)",
              padding: 16
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <Activity size={16} color={theme.cyan} />
              <span style={{ color: theme.text, fontWeight: 700 }}>Scan trend</span>
            </div>
            <div style={{ height: 170 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="riskFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor={theme.cyan} stopOpacity={0.45} />
                      <stop offset="95%" stopColor={theme.cyan} stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={theme.grid} vertical={false} />
                  <XAxis dataKey="slot" tick={{ fill: theme.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: theme.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: theme.backgroundAlt,
                      border: `1px solid ${theme.borderStrong}`,
                      borderRadius: 12,
                      color: theme.text
                    }}
                  />
                  <Area type="monotone" dataKey="risk" stroke={theme.cyan} fill="url(#riskFill)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div
            style={{
              borderRadius: 18,
              border: `1px solid ${theme.border}`,
              background: "rgba(255,255,255,0.03)",
              padding: 16
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <Radar size={16} color={theme.amber} />
              <span style={{ color: theme.text, fontWeight: 700 }}>Suspicious activity spikes</span>
            </div>
            <div style={{ height: 150 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={spikeData}>
                  <CartesianGrid stroke={theme.grid} vertical={false} />
                  <XAxis dataKey="window" tick={{ fill: theme.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: theme.muted, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: theme.backgroundAlt,
                      border: `1px solid ${theme.borderStrong}`,
                      borderRadius: 12,
                      color: theme.text
                    }}
                  />
                  <Bar dataKey="spikes" fill={theme.amber} radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div
            style={{
              borderRadius: 18,
              border: `1px solid ${theme.border}`,
              background: "rgba(255,255,255,0.03)",
              padding: 16
            }}
          >
            <div style={{ color: theme.text, fontWeight: 700, marginBottom: 8 }}>Platform distribution</div>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "130px minmax(0, 1fr)" }}>
              <div style={{ height: 130 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={platformData.length ? platformData : [{ platform: "none", total: 1, color: theme.subtle }]}
                      dataKey="total"
                      innerRadius={34}
                      outerRadius={54}
                      stroke="none"
                    >
                      {(platformData.length ? platformData : [{ color: theme.subtle }]).map((entry) => (
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
              </div>
              <div style={{ display: "grid", gap: 8, alignContent: "center" }}>
                {platformData.map((entry) => (
                  <div key={entry.platform} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <span style={createBadgeStyle(entry.color)}>{entry.platform}</span>
                    <span style={{ color: theme.text }}>{entry.total}</span>
                  </div>
                ))}
                {platformData.length === 0 && <span style={{ color: theme.muted }}>No platform rows yet.</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  )
}
