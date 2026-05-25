import { useEffect, useState } from "react"
import { Activity, AlertTriangle, Shield, Waypoints } from "lucide-react"
import { motion } from "framer-motion"

import ConfidenceGauge from "../components/ConfidenceGauge.jsx"
import DatasetOverview from "../components/DatasetOverview.jsx"
import ExplanationPanel from "../components/ExplanationPanel.jsx"
import FakeVsRealChart from "../components/FakeVsRealChart.jsx"
import FeatureImportanceChart from "../components/FeatureImportanceChart.jsx"
import ModelMetrics from "../components/ModelMetrics.jsx"
import PlatformDistribution from "../components/PlatformDistribution.jsx"
import PredictionPie from "../components/PredictionPie.jsx"
import RecentScansTable from "../components/RecentScansTable.jsx"
import RiskBarChart from "../components/RiskBarChart.jsx"
import RocCurveChart from "../components/RocCurveChart.jsx"
import ScanTimelineChart from "../components/ScanTimelineChart.jsx"
import StatCard from "../components/StatCard.jsx"
import ThreatFeed from "../components/ThreatFeed.jsx"
import { fetchFeatureImportance, fetchModelInfo, fetchModelMetrics } from "../lib/api.js"
import { createBadgeStyle, getConfidenceValue, getProbabilityValue, getRiskTone, theme } from "../lib/dashboardTheme.js"
import { supabase } from "../lib/supabase"

const MAX_SCANS = 100
const SUPABASE_UNAVAILABLE_MESSAGE =
  "Supabase feed unavailable. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to stream live scans."

function getScanKey(scan) {
  if (!scan) {
    return null
  }

  return scan.id ?? `${scan.username ?? "unknown"}-${scan.created_at ?? "pending"}`
}

function sortScans(items) {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left?.created_at ?? 0) || 0
    const rightTime = Date.parse(right?.created_at ?? 0) || 0
    return rightTime - leftTime
  })
}

function mergeScans(current, incoming) {
  const merged = new Map(current.map((scan) => [getScanKey(scan), scan]))

  incoming.forEach((scan) => {
    merged.set(getScanKey(scan), scan)
  })

  return sortScans([...merged.values()]).slice(0, MAX_SCANS)
}

export default function Dashboard() {
  const [scans, setScans] = useState([])
  const [selectedScanKey, setSelectedScanKey] = useState(null)
  const [scanError, setScanError] = useState(supabase ? "" : SUPABASE_UNAVAILABLE_MESSAGE)
  const [loadingScans, setLoadingScans] = useState(Boolean(supabase))
  const [metrics, setMetrics] = useState(null)
  const [metricsError, setMetricsError] = useState("")
  const [importance, setImportance] = useState(null)
  const [importanceError, setImportanceError] = useState("")
  const [modelInfo, setModelInfo] = useState(null)
  const [modelInfoError, setModelInfoError] = useState("")
  const [loadingTelemetry, setLoadingTelemetry] = useState(true)

  useEffect(() => {
    if (!supabase) {
      return undefined
    }

    let cancelled = false

    async function loadScans() {
      const { data, error: loadError } = await supabase
        .from("scans")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(MAX_SCANS)

      if (cancelled) {
        return
      }

      if (loadError) {
        setScanError(loadError.message)
      } else {
        const nextScans = mergeScans([], data ?? [])
        setScanError("")
        setScans(nextScans)
        setSelectedScanKey((current) => current ?? getScanKey(nextScans[0]))
      }

      setLoadingScans(false)
    }

    loadScans()

    const channel = supabase
      .channel("scans-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "scans"
        },
        ({ new: newScan }) => {
          if (!newScan || cancelled) {
            return
          }

          setScans((current) => mergeScans(current, [newScan]))
          setSelectedScanKey((current) => current ?? getScanKey(newScan))
        }
      )
      .subscribe((status) => {
        if (cancelled) {
          return
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setScanError("Supabase realtime connection failed. Check Realtime is enabled for public.scans.")
        }
      })

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadTelemetry() {
      try {
        const [metricsPayload, importancePayload, modelInfoPayload] = await Promise.all([
          fetchModelMetrics(),
          fetchFeatureImportance(),
          fetchModelInfo()
        ])

        if (cancelled) {
          return
        }

        setMetrics(metricsPayload)
        setMetricsError("")
        setImportance(importancePayload)
        setImportanceError("")
        setModelInfo(modelInfoPayload)
        setModelInfoError("")
      } catch (error) {
        if (cancelled) {
          return
        }

        const message = error instanceof Error ? error.message : String(error)
        setMetricsError(message)
        setImportanceError(message)
        setModelInfoError(message)
      } finally {
        if (!cancelled) {
          setLoadingTelemetry(false)
        }
      }
    }

    loadTelemetry()

    return () => {
      cancelled = true
    }
  }, [])

  const selectedScan =
    scans.find((scan) => getScanKey(scan) === selectedScanKey) ?? scans[0] ?? null

  const fakeCount = scans.filter((scan) => scan.label === "fake").length
  const realCount = scans.filter((scan) => scan.label === "real").length
  const averageRisk =
    scans.length === 0
      ? 0
      : Math.round(
          scans.reduce(
            (sum, scan) => sum + (Number(scan.fake_probability) || 0),
            0
          ) * 100 / scans.length
        )
  const averageConfidence =
    scans.length === 0
      ? 0
      : Math.round(
          scans.reduce(
            (sum, scan) => sum + getConfidenceValue(scan),
            0
          ) / scans.length
        )
  const highSeverityCount = scans.filter((scan) => getProbabilityValue(scan) >= 70).length
  const averageRiskTone = getRiskTone(averageRisk)

  return (
    <div
      style={{
        minHeight: "100svh",
        padding: 32,
        display: "grid",
        gap: 24,
        color: theme.text,
        background: `
          radial-gradient(circle at top left, rgba(34, 211, 238, 0.16), transparent 28%),
          radial-gradient(circle at top right, rgba(251, 113, 133, 0.18), transparent 26%),
          linear-gradient(180deg, ${theme.background} 0%, ${theme.backgroundAlt} 100%)
        `
      }}
    >
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 28,
          border: `1px solid ${theme.borderStrong}`,
          padding: 28,
          background: "linear-gradient(135deg, rgba(5, 17, 28, 0.96), rgba(8, 26, 41, 0.92))",
          boxShadow: "0 28px 80px rgba(1, 8, 15, 0.5)"
        }}
      >
        <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          <div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
              <span style={createBadgeStyle(theme.red)}>Realtime pulse</span>
              <span style={createBadgeStyle(theme.cyan)}>Threat intelligence</span>
              <span style={createBadgeStyle(theme.blue)}>SOC dashboard</span>
            </div>
            <h1 style={{ margin: 0, fontSize: 36, color: theme.text }}>
              Mini Threat Intelligence Command Center
            </h1>
            <p style={{ marginTop: 12, maxWidth: 720, color: theme.muted, lineHeight: 1.6 }}>
              Live scan activity, model telemetry, feature importance, and suspicious profile spikes from the latest detection stream.
            </p>
          </div>
          <div
            style={{
              display: "grid",
              gap: 12,
              alignContent: "start",
              minWidth: 0
            }}
          >
            <div style={{ ...createBadgeStyle(theme.amber), justifyContent: "space-between" }}>
              <span>Average confidence</span>
              <strong>{averageConfidence}%</strong>
            </div>
            <div style={{ ...createBadgeStyle(theme.red), justifyContent: "space-between" }}>
              <span>High severity</span>
              <strong>{highSeverityCount}</strong>
            </div>
          </div>
        </div>
      </motion.section>

      <section
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))"
        }}
      >
        <StatCard
          label="Total scans"
          value={scans.length}
          accent={theme.cyan}
          subtext="Latest 100 rows ingested"
          icon={Activity}
        />
        <StatCard
          label="Flagged fake"
          value={fakeCount}
          accent={theme.red}
          subtext="Model label fake"
          icon={AlertTriangle}
        />
        <StatCard
          label="Flagged real"
          value={realCount}
          accent={theme.green}
          subtext="Model label real"
          icon={Shield}
        />
        <StatCard
          label="Average risk"
          value={averageRisk}
          suffix="%"
          accent={averageRiskTone.color}
          subtext="Mean fake probability"
          icon={Waypoints}
        />
      </section>

      {loadingScans && <p style={{ color: theme.muted }}>Loading scan feed...</p>}
      {scanError && <p style={{ color: theme.amber }}>{scanError}</p>}

      <ThreatFeed
        scans={scans}
        selectedScanKey={selectedScan ? getScanKey(selectedScan) : null}
        onSelect={setSelectedScanKey}
      />

      <section
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))"
        }}
      >
        <ModelMetrics
          metrics={metrics}
          loading={loadingTelemetry}
          error={metricsError}
        />
        <DatasetOverview
          metadata={modelInfo}
          loading={loadingTelemetry}
          error={modelInfoError}
        />
      </section>

      <section
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))"
        }}
      >
        <RocCurveChart
          metrics={metrics}
          loading={loadingTelemetry}
          error={metricsError}
        />
        <FeatureImportanceChart
          importance={importance}
          loading={loadingTelemetry}
          error={importanceError}
        />
      </section>

      <section
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          alignItems: "stretch"
        }}
      >
        <PredictionPie scans={scans} />
        <RiskBarChart scans={scans} />
        <FakeVsRealChart scans={scans} />
        <ConfidenceGauge scan={selectedScan} />
        <PlatformDistribution scans={scans} />
      </section>

      <ScanTimelineChart scans={scans} />

      <section
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))"
        }}
      >
        <RecentScansTable
          scans={scans}
          selectedScanKey={selectedScan ? getScanKey(selectedScan) : null}
          onSelect={setSelectedScanKey}
        />
        <ExplanationPanel scan={selectedScan} />
      </section>
    </div>
  )
}
