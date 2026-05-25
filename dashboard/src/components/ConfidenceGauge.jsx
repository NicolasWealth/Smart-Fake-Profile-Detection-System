import { motion } from "framer-motion"

import {
  cardStyle,
  createBadgeStyle,
  getConfidenceBand,
  getConfidenceValue,
  getProbabilityValue,
  getRiskTone,
  theme
} from "../lib/dashboardTheme.js"

export default function ConfidenceGauge({ scan }) {
  const probability = getProbabilityValue(scan)
  const confidence = getConfidenceValue(scan)
  const tone = getRiskTone(probability, confidence, scan?.risk_level || scan?.risk_code || scan?.label)
  const confidenceBand = scan?.confidence_band || getConfidenceBand(confidence)
  const fill = Math.min(Math.max(probability, 0), 100)

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.05 }}
      style={{
        ...cardStyle,
        display: "grid",
        gap: 18
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: 20, color: theme.text }}>Confidence envelope</h2>
        <span style={createBadgeStyle(tone.color)}>{tone.label}</span>
      </div>
      <div
        style={{
          padding: 24,
          borderRadius: 18,
          background: `linear-gradient(90deg, ${tone.color} ${fill}%, rgba(255,255,255,0.05) ${fill}%)`,
          border: `1px solid ${tone.color}33`
        }}
      >
        <div style={{ fontSize: 42, fontWeight: 800, color: theme.text }}>
          {scan ? `${probability}%` : "--"}
        </div>
        <div style={{ color: theme.text, opacity: 0.92 }}>
          {scan ? `${tone.label} risk for @${scan.username || "unknown"}` : "Select a scan"}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }}>
        <div style={{ padding: 14, borderRadius: 16, background: "rgba(255,255,255,0.04)" }}>
          <div style={{ color: theme.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Model Confidence
          </div>
          <div style={{ marginTop: 8, fontSize: 24, fontWeight: 700, color: theme.cyan }}>
            {scan ? `${confidence}%` : "--"}
          </div>
        </div>
        <div style={{ padding: 14, borderRadius: 16, background: "rgba(255,255,255,0.04)" }}>
          <div style={{ color: theme.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Confidence Band
          </div>
          <div style={{ marginTop: 8, fontSize: 24, fontWeight: 700, color: tone.color }}>
            {scan ? confidenceBand : "--"}
          </div>
        </div>
      </div>
    </motion.section>
  )
}
