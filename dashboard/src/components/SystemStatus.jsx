import { useEffect, useState } from "react"
import { DatabaseZap, Radio, Server, ShieldCheck, TimerReset } from "lucide-react"

import { fetchHealth } from "../lib/api.js"
import { cardStyle, createBadgeStyle, formatTimestamp, theme } from "../lib/dashboardTheme.js"

function statusColor(isHealthy) {
  return isHealthy ? theme.green : theme.red
}

function StatusRow({ icon: Icon, label, value, healthy }) {
  const color = statusColor(healthy)

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "center",
        padding: "10px 0",
        borderTop: `1px solid ${theme.grid}`
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: theme.muted }}>
        <Icon size={15} color={color} />
        {label}
      </span>
      <strong style={{ color }}>{value}</strong>
    </div>
  )
}

export default function SystemStatus({ realtimeStatus, lastScan, modelInfo, telemetryError }) {
  const [health, setHealth] = useState(null)
  const [apiError, setApiError] = useState("")

  useEffect(() => {
    let cancelled = false

    async function loadHealth() {
      try {
        const payload = await fetchHealth()
        if (!cancelled) {
          setHealth(payload)
          setApiError("")
        }
      } catch (error) {
        if (!cancelled) {
          setHealth(null)
          setApiError(error instanceof Error ? error.message : String(error))
        }
      }
    }

    loadHealth()
    const intervalId = window.setInterval(loadHealth, 30000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [])

  const apiOnline = health?.status === "online" && !apiError
  const modelLoaded = Boolean(health?.model || modelInfo?.[0]?.model_name)
  const realtimeActive = realtimeStatus === "SUBSCRIBED"
  const modelVersion = health?.model_version || modelInfo?.[0]?.model_version || "--"

  return (
    <section style={{ ...cardStyle, display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, color: theme.text }}>System Status</h2>
          <p style={{ margin: "6px 0 0", color: theme.muted }}>Operational readiness for the live detection loop.</p>
        </div>
        <span style={createBadgeStyle(apiOnline && realtimeActive ? theme.green : theme.amber)}>
          {apiOnline && realtimeActive ? "Live" : "Degraded"}
        </span>
      </div>

      <StatusRow icon={Server} label="API" value={apiOnline ? "Online" : "Offline"} healthy={apiOnline} />
      <StatusRow icon={ShieldCheck} label="Model" value={modelLoaded ? "Loaded" : "Unavailable"} healthy={modelLoaded} />
      <StatusRow icon={Radio} label="Realtime" value={realtimeActive ? "Active" : realtimeStatus || "Pending"} healthy={realtimeActive} />
      <StatusRow icon={TimerReset} label="Last scan" value={lastScan ? formatTimestamp(lastScan.created_at) : "No scans"} healthy={Boolean(lastScan)} />
      <StatusRow icon={DatabaseZap} label="Model version" value={modelVersion} healthy={!telemetryError} />
    </section>
  )
}
