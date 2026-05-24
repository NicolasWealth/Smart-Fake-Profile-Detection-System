import { theme } from "../lib/dashboardTheme.js"

export default function EmptyState({ title = "No scans available", detail = "Waiting for telemetry..." }) {
  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        minHeight: 150,
        padding: 20,
        borderRadius: 16,
        border: `1px dashed ${theme.borderStrong}`,
        background: "rgba(255,255,255,0.025)",
        color: theme.muted,
        textAlign: "center"
      }}
    >
      <div>
        <div style={{ color: theme.text, fontWeight: 700 }}>{title}</div>
        <div style={{ marginTop: 6, fontSize: 13 }}>{detail}</div>
      </div>
    </div>
  )
}
