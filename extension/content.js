let lastObservedPath = ""
let lastCompletedPath = ""
let activeScanPath = ""


function removeBadge() {
  const old = document.getElementById("fake-profile-ai-badge")
  if (old) old.remove()
}

function showBadge(text, color) {
  removeBadge()
  const badge = document.createElement("div")
  badge.id = "fake-profile-ai-badge"
  badge.innerText = text
  badge.style.cssText = `
    position: fixed; top: 90px; right: 20px; z-index: 999999;
    padding: 12px 16px; border-radius: 12px;
    font-size: 14px; font-weight: 700; color: #fff;
    background: ${color}; box-shadow: 0 8px 24px rgba(0,0,0,.25);
  `
  document.body.appendChild(badge)
}

function scheduleRetry(path, delayMs) {
  setTimeout(() => {
    if (window.location.pathname === path) {
      scanProfile()
    }
  }, delayMs)
}

function scanProfile() {
  const path = window.location.pathname

  if (path !== lastObservedPath) {
    lastObservedPath = path
    lastCompletedPath = ""
    activeScanPath = ""
  }

  const parts = path.split("/").filter(Boolean)
  if (parts.length !== 1) return
  if (typeof extractProfileData !== "function") return
  if (typeof buildMlPayload !== "function") return
  if (path === lastCompletedPath || path === activeScanPath) return

  activeScanPath = path

  setTimeout(function delayedScan() {
    if (window.location.pathname !== path) {
      activeScanPath = ""
      return
    }

    const rawProfile = extractProfileData()

    if (!rawProfile) {
      activeScanPath = ""
      removeBadge()
      scheduleRetry(path, 1000)
      return
    }

    const payload = buildMlPayload(rawProfile)

    if (!payload) {
      activeScanPath = ""
      showBadge("Extraction Error", "#555")
      scheduleRetry(path, 1500)
      return
    }

    showBadge("Scanning...", "#444")
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
        console.warn("[FPD] Scan completed but was not saved to Supabase:", {
          server: data.supabase,
          client: data.client_supabase
        })
      }

      const explanation =
        generateExplanation(payload, data)

      console.log(
        "[FPD] Explanation:",
        explanation
      )
      const score = Math.round((data.fake_probability || 0) * 100)
      const risk =
        getRiskLevel(
          data.fake_probability || 0,
          data.confidence
        )

      console.log(
        "[FPD] Risk:",
        risk
      )

      showBadge(
        `${risk.level} Risk\n${score}% suspicious`,
        risk.color
      )
      return

      if (data.label === "fake") {
        showBadge(
          `🔴 Fake ${score}%\n${explanation.reasons[0] || ""}`,
          "#d93025"
        )
      } else {
        showBadge(`Real ${100 - score}%`, "#188038")
      }
    })
  }, 2500)
}

let scanTimeout = null

const observer = new MutationObserver(() => {
  clearTimeout(scanTimeout)

  scanTimeout = setTimeout(() => {
    scanProfile()
  }, 1500)
})

observer.observe(document.body, {
  childList: true,
  subtree: true
})
scanProfile()
