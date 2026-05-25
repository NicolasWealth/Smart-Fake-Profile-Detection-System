import { Download, FileJson, Printer } from "lucide-react"
import { useState } from "react"

import { fetchScanReport } from "../lib/api.js"
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

const FEATURE_FIELDS = [
  "followers_count",
  "following_count",
  "follower_following_ratio",
  "account_age_days",
  "statuses_count",
  "posts_per_day",
  "content_density",
  "tweets_per_day",
  "engagement_proxy",
  "activity_score",
  "growth_signal",
  "has_profile_image",
  "verified",
  "bio_length",
  "username_randomness_score",
  "username_length"
]

function buildFallbackReport(scan) {
  if (!scan) {
    return null
  }

  const confidence = getConfidenceValue(scan)
  const probability = getProbabilityValue(scan)
  const tone = getRiskTone(probability, confidence, scan.risk_level || scan.risk_code || scan.label)

  return {
    scan_id: scan.scan_id || scan.id || "",
    username: scan.username || "",
    platform: scan.platform || "twitter",
    prediction: scan.prediction,
    label: scan.label || "",
    risk_code: scan.risk_code || tone.code,
    risk_level: scan.risk_level || tone.label,
    threat_label: scan.threat_label || tone.label,
    confidence: confidence / 100,
    confidence_band: scan.confidence_band || getConfidenceBand(confidence),
    explanation: Array.isArray(scan.explanation) ? scan.explanation : [],
    timestamp: scan.created_at,
    features: Object.fromEntries(FEATURE_FIELDS.map((field) => [field, scan[field] ?? 0]))
  }
}

function downloadJson(report) {
  const blob = new Blob([JSON.stringify(report, null, 2)], {
    type: "application/json"
  })
  const href = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = href
  link.download = `scan-report-${report.scan_id || report.username || "selected"}.json`
  link.click()
  URL.revokeObjectURL(href)
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function printReport(report, printWindow = window.open("", "_blank")) {
  if (!printWindow) {
    return
  }

  const reasons = (report.explanation || [])
    .map((reason) => `<li>${escapeHtml(reason)}</li>`)
    .join("")
  const features = Object.entries(report.features || {})
    .map(([key, value]) => `<tr><td>${escapeHtml(key)}</td><td>${escapeHtml(value)}</td></tr>`)
    .join("")

  printWindow.document.write(`
    <html>
      <head>
        <title>Scan Report ${escapeHtml(report.username)}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 32px; color: #0f172a; }
          h1 { margin-bottom: 4px; }
          .meta { color: #475569; margin-bottom: 24px; }
          .badge { display: inline-block; padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 999px; margin-right: 8px; }
          table { border-collapse: collapse; width: 100%; margin-top: 16px; }
          td { border-bottom: 1px solid #e2e8f0; padding: 8px; }
        </style>
      </head>
      <body>
        <h1>@${escapeHtml(report.username || "unknown")}</h1>
        <div class="meta">${escapeHtml(report.platform || "twitter")} | ${escapeHtml(formatTimestamp(report.timestamp))}</div>
        <p>
          <span class="badge">${escapeHtml(report.threat_label || report.risk_level)}</span>
          <span class="badge">${Math.round((Number(report.confidence) || 0) * 100)}% confidence</span>
          <span class="badge">${escapeHtml(report.confidence_band || "Low Confidence")}</span>
        </p>
        <h2>Reasoning</h2>
        <ul>${reasons || "<li>No trigger explanations recorded.</li>"}</ul>
        <h2>Features</h2>
        <table>${features}</table>
      </body>
    </html>
  `)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}

export default function ScanReportExport({ scan }) {
  const [error, setError] = useState("")
  const report = buildFallbackReport(scan)

  async function getReport() {
    if (!report) {
      return null
    }

    if (!scan.scan_id) {
      return report
    }

    try {
      const apiReport = await fetchScanReport(scan.scan_id)
      setError("")
      return apiReport
    } catch (err) {
      setError("Using selected dashboard row because API report lookup is unavailable.")
      return report
    }
  }

  async function handleJsonExport() {
    const nextReport = await getReport()
    if (nextReport) {
      downloadJson(nextReport)
    }
  }

  async function handlePdfExport() {
    const printWindow = window.open("", "_blank")
    const nextReport = await getReport()
    if (nextReport) {
      printReport(nextReport, printWindow)
    } else if (printWindow) {
      printWindow.close()
    }
  }

  const confidence = getConfidenceValue(scan)
  const tone = getRiskTone(getProbabilityValue(scan), confidence, scan?.risk_level || scan?.risk_code || scan?.label)

  return (
    <section style={{ ...cardStyle, display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, color: theme.text }}>Export Report</h2>
          <p style={{ margin: "6px 0 0", color: theme.muted }}>Package the selected scan for demo handoff or review.</p>
        </div>
        <span style={createBadgeStyle(tone.color)}>{tone.label}</span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <button type="button" onClick={handleJsonExport} disabled={!scan} style={buttonStyle(theme.cyan)}>
          <FileJson size={16} />
          JSON
        </button>
        <button type="button" onClick={handlePdfExport} disabled={!scan} style={buttonStyle(theme.amber)}>
          <Printer size={16} />
          PDF
        </button>
        <button type="button" onClick={handleJsonExport} disabled={!scan} style={buttonStyle(theme.green)}>
          <Download size={16} />
          Export Report
        </button>
      </div>

      <div style={{ color: theme.muted, fontSize: 13 }}>
        {scan ? `Selected: @${scan.username || "unknown"} | ${getConfidenceBand(confidence)}` : "Select a scan to export."}
      </div>
      {error && <div style={{ color: theme.amber, fontSize: 13 }}>{error}</div>}
    </section>
  )
}

function buttonStyle(color) {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    border: `1px solid ${color}66`,
    borderRadius: 10,
    padding: "9px 12px",
    background: `${color}18`,
    color,
    fontWeight: 800,
    cursor: "pointer"
  }
}
