export const theme = {
  background: "#03111c",
  backgroundAlt: "#071a29",
  panel: "rgba(8, 26, 41, 0.88)",
  panelStrong: "rgba(12, 33, 51, 0.96)",
  border: "rgba(96, 165, 250, 0.18)",
  borderStrong: "rgba(125, 211, 252, 0.28)",
  text: "#e6f2ff",
  muted: "#88a4c2",
  subtle: "#5f7a96",
  grid: "rgba(125, 211, 252, 0.08)",
  cyan: "#22d3ee",
  blue: "#60a5fa",
  green: "#2dd4bf",
  yellow: "#facc15",
  amber: "#fbbf24",
  orange: "#fb923c",
  red: "#fb7185",
  gray: "#94a3b8",
  magenta: "#c084fc"
}

export const severityColors = {
  HIGH: theme.red,
  CRITICAL: theme.red,
  MEDIUM: theme.orange,
  LOW: theme.yellow,
  UNCERTAIN: theme.gray,
  REAL: theme.green
}

export const cardStyle = {
  background: `linear-gradient(180deg, ${theme.panelStrong} 0%, ${theme.panel} 100%)`,
  border: `1px solid ${theme.border}`,
  borderRadius: 24,
  padding: 22,
  boxShadow: "0 24px 80px rgba(1, 8, 15, 0.42)",
  backdropFilter: "blur(18px)"
}

export function getProbabilityValue(scan) {
  return Math.round((Number(scan?.fake_probability) || 0) * 100)
}

export function getConfidenceValue(scan) {
  const explicitConfidence = Number(scan?.confidence)
  if (Number.isFinite(explicitConfidence)) {
    return Math.round(explicitConfidence * 100)
  }

  const probability = Number(scan?.fake_probability) || 0
  return Math.round((probability >= 0.5 ? probability : 1 - probability) * 100)
}

export function getSeverityColor(label) {
  const normalizedLabel = String(label || "").toUpperCase()
  return severityColors[normalizedLabel] || theme.gray
}

export function getRiskTone(
  probability,
  confidence = probability >= 50 ? probability : 100 - probability,
  label = ""
) {
  const normalizedLabel = String(label || "").toUpperCase()

  if (normalizedLabel === "REAL") {
    return { label: "REAL", color: severityColors.REAL }
  }

  if (normalizedLabel === "HIGH" || normalizedLabel === "CRITICAL") {
    return { label: "HIGH", color: severityColors.HIGH }
  }

  if (normalizedLabel === "MEDIUM") {
    return { label: "MEDIUM", color: severityColors.MEDIUM }
  }

  if (normalizedLabel === "LOW") {
    return { label: "LOW", color: severityColors.LOW }
  }

  if (confidence < 60) {
    return { label: "UNCERTAIN", color: severityColors.UNCERTAIN }
  }

  if (probability >= 70) {
    return { label: "HIGH", color: severityColors.HIGH }
  }

  if (probability >= 50) {
    return { label: "MEDIUM", color: severityColors.MEDIUM }
  }

  if (probability >= 30) {
    return { label: "LOW", color: severityColors.LOW }
  }

  return { label: "REAL", color: severityColors.REAL }
}

export function formatTimestamp(value, options = {}) {
  if (!value) {
    return "Pending"
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "Pending"
  }

  return date.toLocaleString([], options)
}

export function createBadgeStyle(color) {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    borderRadius: 999,
    border: `1px solid ${color}55`,
    background: `${color}18`,
    color,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase"
  }
}
