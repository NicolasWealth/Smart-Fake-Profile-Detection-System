import { useState } from "react"
import { FlaskConical, Twitter, Instagram, PlayCircle, CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

import demoAccounts from "../../../demo_accounts.json"
import { predictDemo } from "../lib/api"
import { cardStyle, createBadgeStyle, getRiskTone, theme } from "../lib/dashboardTheme"

// ─── constants ───────────────────────────────────────────────────────────────

const PLATFORM_ORDER = ["twitter", "instagram"]

const PLATFORM_META = {
  twitter: {
    label: "Twitter",
    color: "#1d9bf0",
    Icon: Twitter,
  },
  instagram: {
    label: "Instagram",
    color: "#e1306c",
    Icon: Instagram,
  },
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function groupByPlatform(accounts) {
  const groups = {}
  for (const platform of PLATFORM_ORDER) {
    groups[platform] = []
  }
  for (const account of accounts) {
    const p = account.platform?.toLowerCase()
    if (groups[p]) {
      groups[p].push(account)
    }
  }
  return groups
}

function sorted(accounts) {
  return [...accounts].sort((a, b) => (a.demo_order ?? 99) - (b.demo_order ?? 99))
}

function resultMatchesExpected(result, account) {
  if (!result) return null
  const label = (result.label ?? result.prediction ?? "").toLowerCase()
  const expected = (account.expected ?? "").toLowerCase()
  // Map model "real"/"fake" to risk bands
  if (expected === "real") return label === "real"
  if (expected === "high" || expected === "medium" || expected === "low") return label === "fake"
  return null // UNCERTAIN — model may either way
}

// ─── sub-components ──────────────────────────────────────────────────────────

function PlatformBadge({ platform }) {
  const meta = PLATFORM_META[platform?.toLowerCase()] ?? { label: platform, color: theme.gray }
  const Icon = meta.Icon
  return (
    <span
      style={{
        ...createBadgeStyle(meta.color),
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
      }}
    >
      {Icon && <Icon size={11} />}
      {meta.label}
    </span>
  )
}

function ProbabilityBar({ value }) {
  const pct = Math.round((value ?? 0) * 100)
  const tone = getRiskTone(pct)
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: theme.muted, marginBottom: 4 }}>
        <span>Fake probability</span>
        <strong style={{ color: tone.color }}>{pct}%</strong>
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 99,
          background: "rgba(255,255,255,0.08)",
          overflow: "hidden",
        }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{ height: "100%", background: tone.color, borderRadius: 99 }}
        />
      </div>
    </div>
  )
}

function ResultPanel({ result, account }) {
  const tone = getRiskTone(
    Math.round((result.fake_probability ?? result.probability ?? 0) * 100)
  )
  const passed = resultMatchesExpected(result, account)

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.35 }}
      style={{
        overflow: "hidden",
        marginTop: 12,
        paddingTop: 12,
        borderTop: `1px solid ${theme.border}`,
      }}
    >
      {/* Label row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ ...createBadgeStyle(tone.color) }}>{tone.label}</span>
        {passed === true && (
          <span style={{ ...createBadgeStyle(theme.green), display: "inline-flex", gap: 4, alignItems: "center" }}>
            <CheckCircle2 size={12} /> Pass
          </span>
        )}
        {passed === false && (
          <span style={{ ...createBadgeStyle(theme.red), display: "inline-flex", gap: 4, alignItems: "center" }}>
            <XCircle size={12} /> Unexpected
          </span>
        )}
        {passed === null && (
          <span style={{ ...createBadgeStyle(theme.gray), fontSize: 11 }}>Uncertain — either is valid</span>
        )}
      </div>

      {/* Probability bar */}
      <ProbabilityBar value={result.fake_probability ?? result.probability ?? 0} />

      {/* Threshold note */}
      <p style={{ margin: "6px 0 0", fontSize: 11, color: theme.subtle }}>
        Threshold: {((result.threshold ?? 0.5) * 100).toFixed(0)}% · Expected: <em>{account.expected_label}</em>
      </p>
    </motion.div>
  )
}

function DemoCard({ account }) {
  const [status, setStatus] = useState("idle") // idle | loading | done | error
  const [result, setResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState("")

  async function handleRun() {
    setStatus("loading")
    setResult(null)
    setErrorMsg("")
    try {
      const data = await predictDemo(account.payload)
      setResult(data)
      setStatus("done")
    } catch (err) {
      setErrorMsg(err?.message ?? "Request failed")
      setStatus("error")
    }
  }

  const isLoading = status === "loading"
  const expectedTone = getRiskTone(0, 100, account.expected)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        ...cardStyle,
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
            <PlatformBadge platform={account.platform} />
            <span style={createBadgeStyle(expectedTone.color)}>{account.expected_label}</span>
          </div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: theme.text }}>@{account.username}</p>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: theme.muted, lineHeight: 1.5 }}>
            {account.presentation_note}
          </p>
        </div>

        {/* Run button */}
        <button
          onClick={handleRun}
          disabled={isLoading}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "7px 14px",
            borderRadius: 10,
            border: `1px solid ${theme.cyan}44`,
            background: isLoading ? "rgba(34,211,238,0.06)" : "rgba(34,211,238,0.12)",
            color: isLoading ? theme.muted : theme.cyan,
            fontSize: 12,
            fontWeight: 700,
            cursor: isLoading ? "not-allowed" : "pointer",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            transition: "all 0.2s",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            if (!isLoading) {
              e.currentTarget.style.background = "rgba(34,211,238,0.22)"
              e.currentTarget.style.borderColor = `${theme.cyan}88`
            }
          }}
          onMouseLeave={(e) => {
            if (!isLoading) {
              e.currentTarget.style.background = "rgba(34,211,238,0.12)"
              e.currentTarget.style.borderColor = `${theme.cyan}44`
            }
          }}
        >
          {isLoading
            ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Running…</>
            : <><PlayCircle size={13} /> Run Test</>
          }
        </button>
      </div>

      {/* Result or error */}
      <AnimatePresence>
        {status === "done" && result && (
          <ResultPanel key="result" result={result} account={account} />
        )}
        {status === "error" && (
          <motion.p
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ margin: "10px 0 0", fontSize: 12, color: theme.red }}
          >
            ⚠ {errorMsg}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function PlatformGroup({ platform, accounts }) {
  const meta = PLATFORM_META[platform] ?? { label: platform, color: theme.gray }
  const Icon = meta.Icon

  return (
    <div>
      {/* Group heading */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 14,
          paddingBottom: 10,
          borderBottom: `1px solid ${meta.color}33`,
        }}
      >
        {Icon && <Icon size={16} color={meta.color} />}
        <span style={{ fontWeight: 700, fontSize: 14, color: meta.color, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          {meta.label}
        </span>
        <span style={{ color: theme.subtle, fontSize: 12 }}>— {accounts.length} profiles</span>
      </div>

      {/* Cards grid */}
      <div
        style={{
          display: "grid",
          gap: 14,
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        }}
      >
        {sorted(accounts).map((account) => (
          <DemoCard key={account.payload?.scan_id ?? account.username} account={account} />
        ))}
      </div>
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export default function DemoLab() {
  const [expanded, setExpanded] = useState(true)
  const groups = groupByPlatform(demoAccounts)
  const total = demoAccounts.length

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      style={{
        ...cardStyle,
        borderColor: `${theme.cyan}33`,
      }}
    >
      {/* Section header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          width: "100%",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          color: theme.text,
          textAlign: "left",
        }}
      >
        <FlaskConical size={22} color={theme.cyan} />
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 20, color: theme.text }}>Demo Lab</h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: theme.muted }}>
            {total} pre-configured accounts · click <strong>Run Test</strong> to fire a live prediction
          </p>
        </div>
        <span style={{ color: theme.subtle, fontSize: 20, lineHeight: 1 }}>
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      {/* Collapsible body */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="body"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 28, marginTop: 24 }}>
              {PLATFORM_ORDER.map((platform) =>
                groups[platform]?.length > 0 ? (
                  <PlatformGroup
                    key={platform}
                    platform={platform}
                    accounts={groups[platform]}
                  />
                ) : null
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spinner keyframe — injected once */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </motion.section>
  )
}
