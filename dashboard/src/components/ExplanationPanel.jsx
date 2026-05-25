import {
  cardStyle,
  createBadgeStyle,
  getConfidenceBand,
  getConfidenceValue,
  getProbabilityValue,
  getRiskTone,
  theme
} from "../lib/dashboardTheme.js"

function getReasonList(scan) {
  if (!scan) {
    return []
  }

  if (Array.isArray(scan.explanation) && scan.explanation.length > 0) {
    return scan.explanation
  }

  const reasons = []
  const probability = Number(scan.fake_probability) || 0

  if ((Number(scan.username_randomness_score) || 0) > 0.4) {
    reasons.push("Username structure contains randomness signals commonly seen in automated or disposable accounts")
  }

  if (Number(scan.has_profile_image) === 0) {
    reasons.push("Profile metadata lacks normal authenticity indicators, including a recognizable profile image")
  }

  if ((Number(scan.bio_length) || 0) < 10) {
    reasons.push("Profile biography is too sparse to provide normal identity or context signals")
  }

  if ((Number(scan.content_density) || 0) > 50) {
    reasons.push("Posting density significantly exceeds normal human activity baseline for the account age")
  }

  if ((Number(scan.follower_following_ratio) || 0) > 100) {
    reasons.push("Follower graph is highly asymmetric, which can indicate artificial audience shaping")
  }

  if ((Number(scan.growth_signal) || 0) < 0.5 && (Number(scan.account_age_days) || 0) > 180) {
    reasons.push("Follower growth is unusually weak relative to account age, reducing authenticity confidence")
  }

  if (reasons.length === 0) {
    reasons.push(
      probability >= 0.5
        ? "Multiple account signals deviate from the baseline profile of a typical authentic account"
        : "Observed account signals are aligned with the baseline profile of a typical authentic account"
    )
  }

  return reasons
}

export default function ExplanationPanel({ scan }) {
  const reasons = getReasonList(scan)
  const probability = getProbabilityValue(scan)
  const confidence = getConfidenceValue(scan)
  const tone = getRiskTone(probability, confidence, scan?.risk_level || scan?.risk_code || scan?.label)
  const confidenceBand = scan?.confidence_band || getConfidenceBand(confidence)

  return (
    <section
      style={{
        ...cardStyle
      }}
    >
      <h2 style={{ marginTop: 0, fontSize: 20, color: theme.text }}>Selected scan</h2>
      {!scan && <p style={{ color: theme.muted, marginBottom: 0 }}>No scans available. Waiting for telemetry...</p>}
      {scan && (
        <>
          <div
            style={{
              padding: 16,
              borderRadius: 16,
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${theme.border}`,
              marginBottom: 16
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 700, color: theme.text }}>@{scan.username || "unknown"}</div>
            <div style={{ color: theme.muted, marginTop: 8, display: "flex", flexWrap: "wrap", gap: 10 }}>
              <span>{scan.platform || "twitter"}</span>
              <span>{scan.label || "unknown"}</span>
              <span>{probability}% suspicious</span>
              <span>{confidence}% confidence</span>
              <span>{confidenceBand}</span>
              <span style={createBadgeStyle(tone.color)}>{tone.label}</span>
            </div>
            <div style={{ display: "none" }}>
              {scan.platform || "twitter"} • {scan.label || "unknown"} •{" "}
              {Math.round((Number(scan.fake_probability) || 0) * 100)}% suspicious
            </div>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {reasons.map((reason) => (
              <div
                key={reason}
                style={{
                  borderLeft: `4px solid ${tone.color}`,
                  padding: "10px 12px",
                  background: "rgba(255,255,255,0.04)",
                  borderRadius: 10,
                  color: theme.text
                }}
              >
                {reason}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
