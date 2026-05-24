import { CalendarClock, Database, GitBranch, ShieldAlert } from "lucide-react"

import { cardStyle, formatTimestamp, theme } from "../lib/dashboardTheme.js"
import EmptyState from "./EmptyState.jsx"

function normalizeMetadata(metadata) {
  if (Array.isArray(metadata)) {
    return metadata[0] || null
  }

  return metadata || null
}

function formatNumber(value) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue.toLocaleString() : "--"
}

export default function DatasetOverview({ metadata, loading, error }) {
  const info = normalizeMetadata(metadata)
  const items = [
    {
      label: "Dataset size",
      value: formatNumber(info?.dataset_size),
      color: theme.cyan,
      icon: Database
    },
    {
      label: "Fake samples",
      value: formatNumber(info?.fake_samples),
      color: theme.red,
      icon: ShieldAlert
    },
    {
      label: "Real samples",
      value: formatNumber(info?.real_samples),
      color: theme.green,
      icon: ShieldAlert
    },
    {
      label: "Feature count",
      value: formatNumber(info?.feature_count ?? info?.features?.length),
      color: theme.yellow,
      icon: GitBranch
    },
    {
      label: "Training date",
      value: info?.trained_at ? formatTimestamp(info.trained_at, { dateStyle: "medium", timeStyle: "short" }) : "--",
      color: theme.orange,
      icon: CalendarClock
    },
    {
      label: "Model version",
      value: info?.model_version || "--",
      color: theme.gray,
      icon: GitBranch
    }
  ]

  return (
    <section style={{ ...cardStyle, display: "grid", gap: 16 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 20, color: theme.text }}>Dataset intelligence</h2>
        <p style={{ marginTop: 8, color: theme.muted }}>
          Training sample balance, feature surface, and active model release.
        </p>
      </div>

      {loading && <EmptyState title="Waiting for telemetry..." detail="Loading model metadata." />}
      {error && <EmptyState title="Model metadata unavailable" detail={error} />}

      {!loading && !error && !info && (
        <EmptyState title="No dataset metadata available" detail="Train the model to publish model_metadata.json." />
      )}

      {!loading && !error && info && (
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))"
          }}
        >
          {items.map(({ label, value, color, icon: Icon }) => (
            <div
              key={label}
              style={{
                minHeight: 112,
                borderRadius: 16,
                border: `1px solid ${color}33`,
                background: "rgba(255,255,255,0.035)",
                padding: 14,
                display: "grid",
                alignContent: "space-between",
                gap: 12
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, color: theme.muted }}>
                <span style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
                <Icon size={16} color={color} />
              </div>
              <strong style={{ color, fontSize: label === "Training date" ? 18 : 26 }}>{value}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
