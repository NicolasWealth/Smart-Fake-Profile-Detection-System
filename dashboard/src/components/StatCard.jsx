import { useEffect, useState } from "react"
import { animate, motion, useMotionValue } from "framer-motion"

import { cardStyle, theme } from "../lib/dashboardTheme.js"

function formatValue(value, decimals, suffix) {
  return `${Number(value).toFixed(decimals)}${suffix}`
}

function NumericAnimatedValue({ numericValue, decimals, suffix }) {
  const motionValue = useMotionValue(0)
  const [displayValue, setDisplayValue] = useState(formatValue(0, decimals, suffix))

  useEffect(() => {
    const unsubscribe = motionValue.on("change", (latest) => {
      setDisplayValue(formatValue(latest, decimals, suffix))
    })
    const controls = animate(motionValue, numericValue, {
      duration: 0.9,
      ease: "easeOut"
    })

    return () => {
      unsubscribe()
      controls.stop()
    }
  }, [decimals, motionValue, numericValue, suffix])

  return <span>{displayValue}</span>
}

function AnimatedValue({ value, decimals = 0, suffix = "" }) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) {
    return <span>{value}</span>
  }

  return <NumericAnimatedValue numericValue={numericValue} decimals={decimals} suffix={suffix} />
}

export default function StatCard({
  label,
  value,
  accent,
  subtext,
  suffix = "",
  decimals = 0,
  icon: Icon
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      style={{
        ...cardStyle,
        border: `1px solid ${accent}33`,
        minHeight: 148
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12
        }}
      >
        <div
          style={{
            color: theme.muted,
            fontSize: 13,
            letterSpacing: "0.08em",
            textTransform: "uppercase"
          }}
        >
          {label}
        </div>
        {Icon ? <Icon size={18} color={accent} /> : null}
      </div>
      <div
        style={{
          marginTop: 18,
          fontSize: 34,
          fontWeight: 800,
          color: accent
        }}
      >
        <AnimatedValue value={value} decimals={decimals} suffix={suffix} />
      </div>
      <div style={{ marginTop: 8, color: theme.subtle, fontSize: 13 }}>{subtext}</div>
    </motion.section>
  )
}
