import { motion } from "framer-motion"
import { Activity, Crosshair, Radar, ShieldCheck, TrendingUp } from "lucide-react"

import { cardStyle, theme } from "../lib/dashboardTheme.js"
import EmptyState from "./EmptyState.jsx"

const METRIC_ITEMS = [
  { key: "accuracy", label: "Accuracy", color: theme.cyan, icon: ShieldCheck },
  { key: "precision", label: "Precision", color: theme.blue, icon: Crosshair },
  { key: "recall", label: "Recall", color: theme.green, icon: Radar },
  { key: "f1_score", label: "F1 Score", color: theme.amber, icon: Activity },
  { key: "roc_auc", label: "ROC-AUC", color: theme.magenta, icon: TrendingUp }
]

function formatMetricValue(value) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return "--"
  }

  return `${Math.round(numericValue * 100)}%`
}

export default function ModelMetrics({ metrics, loading, error }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={{
        ...cardStyle,
        display: "grid",
        gap: 18
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, color: theme.text }}>Model telemetry</h2>
          <p style={{ marginTop: 8, color: theme.muted }}>
            Accuracy, precision, recall, F1, ROC-AUC, and decision threshold.
          </p>
        </div>
        <div style={{ color: theme.muted, textAlign: "right", fontSize: 13 }}>
          <div>{metrics?.model_name || "Current model"}</div>
          <div>Threshold {metrics?.threshold ?? "--"}</div>
        </div>
      </div>

      {loading && <EmptyState title="Waiting for telemetry..." detail="Loading model metrics." />}
      {error && <EmptyState title="Model metrics unavailable" detail={error} />}

      {!loading && !error && (
        <>
          <div
            style={{
              display: "grid",
              gap: 14,
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))"
            }}
          >
            {METRIC_ITEMS.map(({ key, label, color, icon: Icon }) => (
              <div
                key={key}
                style={{
                  borderRadius: 18,
                  border: `1px solid ${color}33`,
                  background: "rgba(255,255,255,0.04)",
                  padding: 16
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <span style={{ color: theme.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {label}
                  </span>
                  <Icon size={16} color={color} />
                </div>
                <div style={{ marginTop: 12, fontSize: 28, fontWeight: 800, color }}>
                  {formatMetricValue(metrics?.[key])}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))"
            }}
          >
            <div
              style={{
                borderRadius: 18,
                border: `1px solid ${theme.border}`,
                background: "rgba(255,255,255,0.03)",
                padding: 16
              }}
            >
              <div style={{ color: theme.text, fontWeight: 700 }}>Training notes</div>
              <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
                <div style={{ color: theme.muted }}>Cross-val F1</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: theme.green }}>
                  {formatMetricValue(metrics?.cv_f1)}
                </div>
                <div style={{ color: theme.muted }}>Decision threshold</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: theme.amber }}>
                  {metrics?.threshold ?? "--"}
                </div>
                <div style={{ color: theme.muted }}>Model</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: theme.text }}>
                  {metrics?.model_name || "Unavailable"}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </motion.section>
  )
}
