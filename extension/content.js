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

const PLATFORM_LABELS = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  twitter: "X/Twitter"
}

const RESERVED_PROFILE_PATHS = new Set([
  "about", "bookmarks", "events", "explore", "friends", "groups", "gaming",
  "help", "home", "marketplace", "messages", "notifications", "pages", "photo",
  "photos", "profile.php", "reel", "reels", "search", "settings", "stories",
  "watch"
])

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

function detectCurrentPageStatus() {
  const host = location.hostname.toLowerCase()
  const pathParts = location.pathname.split("/").filter(Boolean)
  let platform = ""
  let username = ""

  if (host.includes("instagram.com")) {
    platform = "instagram"
    username = pathParts[0] || ""
  } else if (host.includes("tiktok.com")) {
    platform = "tiktok"
    username = (pathParts[0] || "").replace(/^@/, "")
  } else if (host.includes("facebook.com")) {
    platform = "facebook"
    if (pathParts[0] === "profile.php") {
      username = new URLSearchParams(location.search).get("id") || ""
    } else if (pathParts[0] === "people") {
      username = pathParts[1] || ""
    } else {
      username = pathParts[0] || ""
    }
  } else if (host.includes("twitter.com") || host.includes("x.com")) {
    platform = "twitter"
    username = pathParts[0] || ""
  }

  const supported = Boolean(
    platform &&
    username &&
    !RESERVED_PROFILE_PATHS.has(username.toLowerCase())
  )

  return {
    supported,
    platform: supported ? PLATFORM_LABELS[platform] : "",
    platform_key: supported ? platform : "",
    username: supported ? username : ""
  }
}

function scheduleRetry(path, delayMs) {
  setTimeout(() => {
    if (window.location.pathname === path) scanProfile()
  }, delayMs)
}

async function scanProfile(options = {}) {
  const { force = false, showStatus = true } = options
  const path = window.location.pathname

  // Reset state on URL change
  if (path !== lastObservedPath) {
    lastObservedPath  = path
    lastCompletedPath = ""
    activeScanPath    = ""
  }

  if (!detectCurrentPageStatus().supported) {
    return { success: false, error: "No profile detected on this page" }
  }
  if (typeof buildMlPayload !== "function") {
    return { success: false, error: "Feature builder is unavailable" }
  }
  if (!force && path === lastCompletedPath) {
    return { success: false, error: "Profile already scanned" }
  }
  if (path === activeScanPath) {
    return { success: false, error: "Scan already running" }
  }

  activeScanPath = path

  // Extraction waits internally for profile elements via MutationObserver
  const rawProfile = await extractCurrentPlatformProfile()

  if (window.location.pathname !== path) {
    activeScanPath = ""
    return { success: false, error: "Page changed before scan completed" }
  }

  if (!rawProfile) {
    activeScanPath = ""
    if (showStatus) removeBadge()
    scheduleRetry(path, 1500)
    return { success: false, error: "Could not extract profile data" }
  }

  const payload = buildMlPayload(rawProfile)

  if (!payload) {
    activeScanPath = ""
    if (showStatus) showBadge("Extraction Error", "#555")
    scheduleRetry(path, 1500)
    return { success: false, error: "Could not build ML payload" }
  }

  if (showStatus) showBadge("Scanning...", "#444")
  console.log("[FPD] Raw profile:", rawProfile)
  console.log("[FPD] Payload to backend:", payload)

  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "SCAN_PAGE", payload }, function onScanResponse(response) {
      console.log("[FPD] Response:", response)

      activeScanPath = ""

      if (chrome.runtime.lastError) {
        console.error("[FPD] Runtime error:", chrome.runtime.lastError)
        if (showStatus) showBadge("Extension Error", "#555")
        resolve({ success: false, error: chrome.runtime.lastError.message })
        return
      }

      if (!response || !response.success) {
        console.error("[FPD] Scan failed:", response?.error || "Unknown error")
        if (showStatus) showBadge("API Error", "#555")
        resolve({ success: false, error: response?.error || "Unknown scan error" })
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
        : { reasons: [] }

      console.log("[FPD] Explanation:", explanation)

      const score = Math.round((data.fake_probability || 0) * 100)
      const risk  = typeof getRiskLevel === "function"
        ? getRiskLevel(data.fake_probability || 0, data.confidence)
        : { level: data.risk_level || "Unknown", color: "#444" }

      console.log("[FPD] Risk:", risk)

      if (showStatus) showBadge(`${risk.level}\n${score}% suspicious`, risk.color)

      resolve({
        success: true,
        data: {
          ...data,
          explanation: data.explanation || explanation.reasons || [],
          risk
        }
      })
    })
  })
}

// ─── MutationObserver bootstrap ───────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "GET_PAGE_STATUS") {
    sendResponse(detectCurrentPageStatus())
    return false
  }

  if (message?.type === "TRIGGER_SCAN") {
    scanProfile({ force: true, showStatus: true })
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        })
      })
    return true
  }

  return false
})

let scanTimeout = null

// Debounced observer: re-run scanProfile on any DOM change (covers SPA navigation)
const observer = new MutationObserver(() => {
  clearTimeout(scanTimeout)
  scanTimeout = setTimeout(() => scanProfile(), 1200)
})

observer.observe(document.body, { childList: true, subtree: true })

// Initial scan on script load
scanProfile()
