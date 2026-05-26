import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, X, Hash, AtSign, Globe } from "lucide-react"
import { theme, createBadgeStyle, getProbabilityValue, getRiskTone, formatTimestamp } from "../lib/dashboardTheme.js"

const PLATFORMS = ["twitter", "instagram", "facebook", "linkedin", "tiktok"]

function matchesTerm(scan, term) {
  if (!term) return true
  const lower = term.toLowerCase()
  const username = (scan.username || "").toLowerCase()
  const id = String(scan.id || "").toLowerCase()
  const platform = (scan.platform || "twitter").toLowerCase()
  return username.includes(lower) || id.includes(lower) || platform.includes(lower)
}

function matchesPlatformFilter(scan, platform) {
  if (!platform) return true
  return (scan.platform || "twitter").toLowerCase() === platform
}

export default function SearchBar({ scans, onFilteredResults }) {
  const [query, setQuery] = useState("")
  const [platformFilter, setPlatformFilter] = useState("")
  const [focused, setFocused] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const inputRef = useRef(null)
  const containerRef = useRef(null)

  // Apply filters whenever query or platformFilter changes
  useEffect(() => {
    const results = scans.filter(
      (scan) => matchesTerm(scan, query) && matchesPlatformFilter(scan, platformFilter)
    )
    onFilteredResults(results, query || platformFilter ? true : false)
  }, [query, platformFilter, scans, onFilteredResults])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const hasFilter = query.trim() !== "" || platformFilter !== ""
  const previewScans = scans
    .filter((scan) => matchesTerm(scan, query) && matchesPlatformFilter(scan, platformFilter))
    .slice(0, 5)

  const inputId = "search-bar-input"

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{ position: "relative", width: "100%", zIndex: 50 }}
    >
      {/* Main search row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 16px",
          borderRadius: focused ? "18px 18px 0 0" : 18,
          border: `1px solid ${focused ? theme.cyan + "88" : theme.border}`,
          background: focused
            ? "rgba(8, 32, 52, 0.98)"
            : "rgba(8, 26, 41, 0.88)",
          boxShadow: focused ? `0 0 0 3px ${theme.cyan}18` : "none",
          transition: "all 0.25s ease",
          backdropFilter: "blur(18px)"
        }}
      >
        <Search size={17} color={focused ? theme.cyan : theme.muted} style={{ flexShrink: 0, transition: "color 0.2s" }} />

        <input
          id={inputId}
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setShowDropdown(true)
          }}
          onFocus={() => { setFocused(true); setShowDropdown(true) }}
          onBlur={() => setFocused(false)}
          placeholder="Search by username, scan ID, or platform…"
          style={{
            flex: 1,
            background: "none",
            border: "none",
            outline: "none",
            color: theme.text,
            fontSize: 14,
            letterSpacing: "0.01em",
            caretColor: theme.cyan
          }}
        />

        {/* Platform filter chips */}
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {PLATFORMS.map((p) => (
            <button
              key={p}
              onClick={() => {
                setPlatformFilter((prev) => (prev === p ? "" : p))
                setShowDropdown(true)
              }}
              title={p}
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                border: `1px solid ${platformFilter === p ? theme.cyan + "88" : theme.border}`,
                background: platformFilter === p ? `${theme.cyan}20` : "transparent",
                color: platformFilter === p ? theme.cyan : theme.muted,
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                cursor: "pointer",
                transition: "all 0.18s ease"
              }}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Clear button */}
        <AnimatePresence>
          {hasFilter && (
            <motion.button
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.15 }}
              onClick={() => { setQuery(""); setPlatformFilter(""); inputRef.current?.focus() }}
              style={{
                background: "none",
                border: "none",
                padding: 4,
                borderRadius: 6,
                cursor: "pointer",
                color: theme.muted,
                display: "flex",
                alignItems: "center"
              }}
              title="Clear search"
            >
              <X size={15} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Dropdown preview */}
      <AnimatePresence>
        {showDropdown && focused && query.trim() !== "" && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              borderRadius: "0 0 18px 18px",
              border: `1px solid ${theme.cyan}44`,
              borderTop: "none",
              background: "rgba(6, 22, 36, 0.98)",
              backdropFilter: "blur(22px)",
              boxShadow: `0 24px 60px rgba(1, 8, 15, 0.5)`,
              overflow: "hidden"
            }}
          >
            {previewScans.length > 0 ? (
              previewScans.map((scan) => {
                const prob = getProbabilityValue(scan)
                const tone = getRiskTone(prob)
                return (
                  <div
                    key={scan.id ?? scan.username}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "11px 18px",
                      borderBottom: `1px solid ${theme.border}`,
                      cursor: "default"
                    }}
                  >
                    {/* Username */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 130 }}>
                      <AtSign size={13} color={theme.muted} />
                      <span style={{ color: theme.text, fontSize: 13, fontWeight: 600 }}>
                        {scan.username || "unknown"}
                      </span>
                    </div>

                    {/* Scan ID */}
                    <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 110 }}>
                      <Hash size={12} color={theme.muted} />
                      <span style={{ color: theme.subtle, fontSize: 12, fontFamily: "monospace" }}>
                        {String(scan.id || "—").slice(0, 12)}
                      </span>
                    </div>

                    {/* Platform */}
                    <div style={{ display: "flex", alignItems: "center", gap: 5, flex: 1 }}>
                      <Globe size={12} color={theme.muted} />
                      <span style={{ color: theme.muted, fontSize: 12, textTransform: "capitalize" }}>
                        {scan.platform || "twitter"}
                      </span>
                    </div>

                    {/* Risk badge */}
                    <span style={{ ...createBadgeStyle(tone.color), fontSize: 10 }}>
                      {tone.label}
                    </span>

                    {/* Timestamp */}
                    <span style={{ color: theme.subtle, fontSize: 11, minWidth: 60, textAlign: "right" }}>
                      {formatTimestamp(scan.created_at, { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                )
              })
            ) : (
              <div style={{ padding: "14px 18px", color: theme.muted, fontSize: 13 }}>
                No scans match <strong style={{ color: theme.text }}>"{query}"</strong>
              </div>
            )}

            {previewScans.length > 0 && (
              <div style={{ padding: "8px 18px", color: theme.subtle, fontSize: 11, textAlign: "right" }}>
                Showing {previewScans.length} of {scans.filter((s) => matchesTerm(s, query) && matchesPlatformFilter(s, platformFilter)).length} results
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
