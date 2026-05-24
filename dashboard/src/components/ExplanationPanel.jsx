import {
  cardStyle,
  createBadgeStyle,
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
    reasons.push("Username randomness detected")
  }

  if (Number(scan.has_profile_image) === 0) {
    reasons.push("Missing profile image")
  }

  if ((Number(scan.bio_length) || 0) < 10) {
    reasons.push("Very short biography")
  }

  if ((Number(scan.content_density) || 0) > 50) {
    reasons.push("Abnormal posting activity")
  }

  if ((Number(scan.follower_following_ratio) || 0) > 100) {
    reasons.push("Highly lopsided follower ratio")
  }

  if ((Number(scan.growth_signal) || 0) < 0.5 && (Number(scan.account_age_days) || 0) > 180) {
    reasons.push("Weak follower growth for account age")
  }

  if (reasons.length === 0) {
    reasons.push(
      probability >= 0.5
        ? "Several account signals differ from typical real profiles"
        : "Risk score is driven by a low suspiciousness profile."
    )
  }

  return reasons
}

export default function ExplanationPanel({ scan }) {
  const reasons = getReasonList(scan)
  const probability = getProbabilityValue(scan)
  const confidence = getConfidenceValue(scan)
  const tone = getRiskTone(probability, confidence, scan?.risk_level || scan?.label)

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
