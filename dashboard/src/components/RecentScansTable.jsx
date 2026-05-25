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
import EmptyState from "./EmptyState.jsx"

function getRowKey(scan) {
  return scan?.id ?? `${scan?.username ?? "unknown"}-${scan?.created_at ?? "pending"}`
}

export default function RecentScansTable({ scans, selectedScanKey, onSelect }) {
  return (
    <section
      style={{
        ...cardStyle
      }}
    >
      <h2 style={{ marginTop: 0, fontSize: 20, color: theme.text }}>Recent scans</h2>
      {scans.length === 0 && (
        <EmptyState title="No scans available" detail="Waiting for telemetry from the live scan feed." />
      )}
      <div style={{ overflowX: "auto" }}>
        {scans.length > 0 && <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: theme.muted }}>
              <th style={{ paddingBottom: 12 }}>User</th>
              <th style={{ paddingBottom: 12 }}>Platform</th>
              <th style={{ paddingBottom: 12 }}>Risk</th>
              <th style={{ paddingBottom: 12 }}>Confidence</th>
              <th style={{ paddingBottom: 12 }}>Band</th>
              <th style={{ paddingBottom: 12 }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {scans.map((scan) => {
              const rowKey = getRowKey(scan)
              const isSelected = rowKey === selectedScanKey
              const probability = getProbabilityValue(scan)
              const confidence = getConfidenceValue(scan)
              const tone = getRiskTone(probability, confidence, scan.risk_level || scan.risk_code || scan.label)
              const confidenceBand = scan.confidence_band || getConfidenceBand(confidence)

              return (
                <tr
                  key={rowKey}
                  onClick={() => onSelect(rowKey)}
                  style={{
                    cursor: "pointer",
                    background: isSelected ? "rgba(96, 165, 250, 0.12)" : "transparent",
                    borderTop: `1px solid ${theme.grid}`
                  }}
                >
                  <td style={{ padding: "12px 0", color: theme.text }}>@{scan.username || "unknown"}</td>
                  <td style={{ padding: "12px 0", color: theme.muted, textTransform: "capitalize" }}>
                    {scan.platform || "twitter"}
                  </td>
                  <td style={{ padding: "12px 0" }}>
                    <span style={createBadgeStyle(tone.color)}>{tone.label}</span>
                  </td>
                  <td style={{ padding: "12px 0", color: theme.text }}>{confidence}%</td>
                  <td style={{ padding: "12px 0", color: theme.muted }}>{confidenceBand}</td>
                  <td style={{ padding: "12px 0", color: theme.muted }}>
                    {formatTimestamp(scan.created_at)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>}
      </div>
    </section>
  )
}
