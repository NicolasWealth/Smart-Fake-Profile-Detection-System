import { Activity } from "lucide-react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts"

import { cardStyle, theme } from "../lib/dashboardTheme.js"
import EmptyState from "./EmptyState.jsx"

export default function RocCurveChart({ metrics, loading, error }) {
  const rocCurve = Array.isArray(metrics?.roc_curve) ? metrics.roc_curve : []

  return (
    <section style={{ ...cardStyle, display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, color: theme.text }}>ROC curve</h2>
          <p style={{ marginTop: 8, color: theme.muted }}>
            False positive rate on X, true positive rate on Y.
          </p>
        </div>
        <Activity size={18} color={theme.cyan} />
      </div>

      {loading && <EmptyState title="Waiting for telemetry..." detail="Loading ROC points from model metrics." />}
      {error && <EmptyState title="Model telemetry unavailable" detail={error} />}

      {!loading && !error && rocCurve.length > 1 && (
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rocCurve} margin={{ top: 8, right: 18, bottom: 10, left: 0 }}>
              <CartesianGrid stroke={theme.grid} />
              <XAxis
                dataKey="fpr"
                type="number"
                domain={[0, 1]}
                label={{ value: "FPR", position: "insideBottom", fill: theme.muted, offset: -6 }}
                tick={{ fill: theme.muted, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                dataKey="tpr"
                type="number"
                domain={[0, 1]}
                label={{ value: "TPR", angle: -90, position: "insideLeft", fill: theme.muted }}
                tick={{ fill: theme.muted, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: theme.backgroundAlt,
                  border: `1px solid ${theme.borderStrong}`,
                  borderRadius: 12,
                  color: theme.text
                }}
                formatter={(value) => Number(value).toFixed(3)}
              />
              <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]} stroke={theme.gray} strokeDasharray="4 4" />
              <Line type="monotone" dataKey="tpr" name="TPR" stroke={theme.cyan} strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {!loading && !error && rocCurve.length <= 1 && (
        <EmptyState
          title="No ROC data available"
          detail="Re-run the training pipeline to export ROC curve points."
        />
      )}
    </section>
  )
}
