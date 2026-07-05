/**
 * content.js
 *
 * Orchestrates the scan lifecycle on each page navigation.
 *
 * Changes from previous version:
 *  - Badge moved to top-center (not top-right) with a close button.
 *  - MutationObserver triggers scanProfile when the profile header appears.
 *  - Fixed delay (setTimeout 2500ms) replaced with element-aware waiting
 *    inside each platform extractor.
 *  - scheduleRetry kept as a safety net for edge cases only.
 */

let lastObservedPath  = ""
let lastCompletedPath = ""
let activeScanPath    = ""

// ─── Badge ────────────────────────────────────────────────────────────────────

function removeBadge() {
  document.getElementById("fake-profile-ai-badge")?.remove()
}

function showBadge(text, color) {
  removeBadge()

  const badge = document.createElement("div")
  badge.id = "fake-profile-ai-badge"
  badge.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 999999;
    padding: 12px 36px 12px 18px;
    border-radius: 14px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    font-weight: 700;
    color: #fff;
    background: ${color};
    box-shadow: 0 8px 32px rgba(0,0,0,.35);
    white-space: pre-line;
    text-align: center;
    max-width: 340px;
    min-width: 180px;
  `
  badge.innerText = text

  // Close button
  const closeBtn = document.createElement("button")
  closeBtn.className = "fpd-close"
  closeBtn.innerText = "×"
  closeBtn.style.cssText = `
    position: absolute;
    top: 8px;
    right: 10px;
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 18px;
    color: rgba(255,255,255,0.8);
    line-height: 1;
    padding: 0;
  `
  closeBtn.addEventListener("click", () => badge.remove())
  badge.appendChild(closeBtn)

  document.body.appendChild(badge)
}

// ─── Platform Detection ───────────────────────────────────────────────────────

async function extractCurrentPlatformProfile() {
  if (location.hostname.includes("instagram.com")) {
    if (typeof extractInstagramProfile !== "function") return null
    return extractInstagramProfile()
  }

  if (location.hostname.includes("tiktok.com")) {
    if (typeof extractTikTokProfile !== "function") return null
    return extractTikTokProfile()
  }

  if (location.hostname.includes("facebook.com")) {
    if (typeof extractFacebookProfile !== "function") return null
    return extractFacebookProfile()
  }

  if (
    location.hostname.includes("twitter.com") ||
    location.hostname.includes("x.com")
  ) {
    if (typeof extractTwitterProfile === "function") return extractTwitterProfile()
    if (typeof extractProfileData    === "function") return extractProfileData()
    return null
  }

  return null
}

// ─── Scan ─────────────────────────────────────────────────────────────────────

function scheduleRetry(path, delayMs) {
  setTimeout(() => {
    if (window.location.pathname === path) scanProfile()
  }, delayMs)
}

async function scanProfile() {
  const path = window.location.pathname

  // Reset state on URL change
  if (path !== lastObservedPath) {
    lastObservedPath  = path
    lastCompletedPath = ""
    activeScanPath    = ""
  }

  const parts = path.split("/").filter(Boolean)
  if (parts.length !== 1) return
  if (typeof buildMlPayload !== "function") return
  if (path === lastCompletedPath || path === activeScanPath) return

  activeScanPath = path

  // Extraction waits internally for profile elements via MutationObserver
  const rawProfile = await extractCurrentPlatformProfile()

  if (window.location.pathname !== path) {
    activeScanPath = ""
    return
  }

  if (!rawProfile) {
    activeScanPath = ""
    removeBadge()
    scheduleRetry(path, 1500)
    return
  }

  const payload = buildMlPayload(rawProfile)

  if (!payload) {
    activeScanPath = ""
    showBadge("Extraction Error", "#555")
    scheduleRetry(path, 1500)
    return
  }

  showBadge("Scanning…", "#444")
  console.log("[FPD] Raw profile:", rawProfile)
  console.log("[FPD] Payload to backend:", payload)

  chrome.runtime.sendMessage({ type: "SCAN_PAGE", payload }, function onScanResponse(response) {
    console.log("[FPD] Response:", response)

    activeScanPath = ""

    if (chrome.runtime.lastError) {
      console.error("[FPD] Runtime error:", chrome.runtime.lastError)
      showBadge("Extension Error", "#555")
      return
    }

    if (!response || !response.success) {
      console.error("[FPD] Scan failed:", response?.error || "Unknown error")
      showBadge("API Error", "#555")
      return
    }

    lastCompletedPath = path

    const data = response.data

    if (data.supabase_saved === false) {
      console.warn("[FPD] Scan completed but not saved to Supabase:", {
        server: data.supabase,
        client: data.client_supabase
      })
    }

    const explanation = typeof generateExplanation === "function"
      ? generateExplanation(payload, data)
      : []

    console.log("[FPD] Explanation:", explanation)

    const score = Math.round((data.fake_probability || 0) * 100)
    const risk  = typeof getRiskLevel === "function"
      ? getRiskLevel(data.fake_probability || 0, data.confidence)
      : { level: data.risk_level || "Unknown", color: "#444" }

    console.log("[FPD] Risk:", risk)

    showBadge(`${risk.level}\n${score}% suspicious`, risk.color)
  })
}

// ─── MutationObserver bootstrap ───────────────────────────────────────────────

let scanTimeout = null

// Debounced observer: re-run scanProfile on any DOM change (covers SPA navigation)
const observer = new MutationObserver(() => {
  clearTimeout(scanTimeout)
  scanTimeout = setTimeout(() => scanProfile(), 1200)
})

observer.observe(document.body, { childList: true, subtree: true })

// Initial scan on script load
scanProfile()
