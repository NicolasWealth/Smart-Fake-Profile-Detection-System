import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { theme, formatTimestamp, getProbabilityValue } from "../lib/dashboardTheme.js"

const PULSE_DURATION = 1600 // ms per pulse cycle

/**
 * LivePulseIndicator
 *
 * Props:
 *   realtimeStatus  - string from Supabase channel: "SUBSCRIBED" | "CONNECTING" | "CHANNEL_ERROR" | "TIMED_OUT" | "UNAVAILABLE"
 *   lastScan        - the most recent scan object (or null)
 *   scans           - full scans array (to detect high-risk inserts)
 */
export default function LivePulseIndicator({ realtimeStatus, lastScan, scans }) {
  const [highRiskFlash, setHighRiskFlash] = useState(false)
  const prevScanIdRef = useRef(null)
  const flashTimerRef = useRef(null)

  // Detect a new high-risk scan insert
  useEffect(() => {
    if (!lastScan) return

    const latestId = lastScan.id ?? `${lastScan.username}-${lastScan.created_at}`
    if (latestId === prevScanIdRef.current) return
    prevScanIdRef.current = latestId

    const prob = getProbabilityValue(lastScan)
    if (prob >= 70) {
      setHighRiskFlash(true)
      clearTimeout(flashTimerRef.current)
      flashTimerRef.current = setTimeout(() => setHighRiskFlash(false), 2800)
    }
  }, [lastScan])

  useEffect(() => {
    return () => clearTimeout(flashTimerRef.current)
  }, [])

  const isConnected = realtimeStatus === "SUBSCRIBED"
  const isConnecting = realtimeStatus === "CONNECTING"
  const isError = realtimeStatus === "CHANNEL_ERROR" || realtimeStatus === "TIMED_OUT"
  const isUnavailable = realtimeStatus === "UNAVAILABLE"

  // Derive pulse color
  const pulseColor = highRiskFlash
    ? theme.red
    : isConnected
    ? theme.green
    : isConnecting
    ? theme.amber
    : theme.subtle

  const statusLabel = highRiskFlash
    ? "HIGH RISK DETECTED"
    : isConnected
    ? "TELEMETRY ACTIVE"
    : isConnecting
    ? "CONNECTING…"
    : isError
    ? "CONNECTION ERROR"
    : "OFFLINE"

  const statusColor = highRiskFlash
    ? theme.red
    : isConnected
    ? theme.green
    : isConnecting
    ? theme.amber
    : isError
    ? theme.red
    : theme.subtle

  const highRiskCount = scans.filter((s) => getProbabilityValue(s) >= 70).length

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.45 }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 20px",
        borderRadius: 999,
        border: `1px solid ${pulseColor}44`,
        background: `linear-gradient(135deg, rgba(6, 20, 32, 0.96), rgba(8, 26, 41, 0.9))`,
        backdropFilter: "blur(16px)",
        boxShadow: highRiskFlash
          ? `0 0 0 3px ${theme.red}30, 0 8px 32px rgba(251, 113, 133, 0.22)`
          : isConnected
          ? `0 0 0 2px ${theme.green}22, 0 6px 24px rgba(45, 212, 191, 0.1)`
          : "none",
        transition: "box-shadow 0.35s ease, border-color 0.35s ease",
        whiteSpace: "nowrap",
        userSelect: "none"
      }}
    >
      {/* Pulsing dot */}
      <div style={{ position: "relative", width: 14, height: 14, flexShrink: 0 }}>
        {/* Outer ripple */}
        {(isConnected || highRiskFlash) && (
          <motion.div
            animate={{ scale: [1, 2.2, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: PULSE_DURATION / 1000, repeat: Infinity, ease: "easeInOut" }}
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background: pulseColor,
              opacity: 0.5
            }}
          />
        )}
        {/* Core dot */}
        <motion.div
          animate={
            isConnecting
              ? { opacity: [1, 0.3, 1] }
              : {}
          }
          transition={
            isConnecting
              ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
              : {}
          }
          style={{
            position: "absolute",
            inset: 2,
            borderRadius: "50%",
            background: pulseColor,
            boxShadow: `0 0 8px ${pulseColor}`,
            transition: "background 0.3s ease"
          }}
        />
      </div>

      {/* Status label */}
      <AnimatePresence mode="wait">
        <motion.span
          key={statusLabel}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.2 }}
          style={{
            color: statusColor,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            transition: "color 0.3s ease"
          }}
        >
          {statusLabel}
        </motion.span>
      </AnimatePresence>

      {/* Divider */}
      <div
        style={{
          width: 1,
          height: 20,
          background: theme.border,
          flexShrink: 0
        }}
      />

      {/* High-risk counter */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: theme.muted, fontSize: 11 }}>High-risk</span>
        <motion.span
          key={highRiskCount}
          initial={{ scale: 1.4, color: theme.red }}
          animate={{ scale: 1, color: highRiskCount > 0 ? theme.red : theme.subtle }}
          transition={{ duration: 0.3 }}
          style={{ fontWeight: 800, fontSize: 12 }}
        >
          {highRiskCount}
        </motion.span>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 20, background: theme.border, flexShrink: 0 }} />

      {/* Latest scan timestamp */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: theme.muted, fontSize: 11 }}>Latest</span>
        <span style={{ color: theme.text, fontSize: 11, fontWeight: 600, fontFamily: "monospace" }}>
          {lastScan
            ? formatTimestamp(lastScan.created_at, { hour: "2-digit", minute: "2-digit", second: "2-digit" })
            : "—"}
        </span>
      </div>
    </motion.div>
  )
}
