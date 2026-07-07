const HISTORY_URL = "https://smart-fake-profile-detection-system.vercel.app"
const UNSUPPORTED_MESSAGE =
  "This website isn't supported. Open an X, Instagram, Facebook, or TikTok profile."

const statusEl = document.getElementById("status")
const platformEl = document.getElementById("platform")
const usernameEl = document.getElementById("username")
const scanButton = document.getElementById("scan-profile")
const historyButton = document.getElementById("view-history")
const resultEl = document.getElementById("result")

let activeTabId = null
let pageSupported = false

function setStatus(message) {
  statusEl.textContent = message
}

function setProfile({ platform = "-", username = "-" } = {}) {
  platformEl.textContent = platform || "-"
  usernameEl.textContent = username || "-"
}

function setUnsupported() {
  pageSupported = false
  scanButton.disabled = true
  setStatus(UNSUPPORTED_MESSAGE)
  setProfile()
}

function getConfidencePercent(data) {
  const confidence = Number(data?.confidence)
  const probability = Number(data?.fake_probability ?? data?.probability)
  const value = Number.isFinite(confidence)
    ? confidence
    : Number.isFinite(probability)
      ? probability
      : 0

  return Math.round(value * 100)
}

function getRisk(data) {
  if (data?.risk?.level || data?.risk?.color) {
    return data.risk
  }

  const riskLevel = data?.risk_level || data?.threat_label || "Unknown Risk"
  const probability = Number(data?.fake_probability ?? data?.probability) || 0

  if (probability >= 0.7) return { level: riskLevel, color: "#d93025" }
  if (probability >= 0.3) return { level: riskLevel, color: "#f9ab00" }
  return { level: riskLevel, color: "#188038" }
}

function getReasons(data) {
  if (Array.isArray(data?.explanation)) return data.explanation
  if (Array.isArray(data?.reasons)) return data.reasons
  return []
}

function renderResult(data) {
  const label = String(data?.label || data?.prediction || "").toLowerCase() === "fake"
    ? "Fake"
    : "Genuine"
  const confidence = getConfidencePercent(data)
  const risk = getRisk(data)
  const reasons = getReasons(data)

  resultEl.replaceChildren()

  const labelEl = document.createElement("p")
  labelEl.innerHTML = `<strong>Result:</strong> ${label}`

  const confidenceEl = document.createElement("p")
  confidenceEl.innerHTML = `<strong>Confidence:</strong> ${confidence}%`

  const riskEl = document.createElement("p")
  riskEl.innerHTML = `<strong>Risk:</strong> ${risk.level || "Unknown Risk"}`
  riskEl.style.color = risk.color || "#444"

  const reasonsTitle = document.createElement("p")
  reasonsTitle.innerHTML = "<strong>Explanation:</strong>"

  const reasonsList = document.createElement("ul")
  reasons.forEach((reason) => {
    const item = document.createElement("li")
    item.textContent = reason
    reasonsList.appendChild(item)
  })

  if (reasons.length === 0) {
    const item = document.createElement("li")
    item.textContent = "No explanation reasons were returned."
    reasonsList.appendChild(item)
  }

  resultEl.append(labelEl, confidenceEl, riskEl, reasonsTitle, reasonsList)
}

function sendTabMessage(message) {
  return new Promise((resolve, reject) => {
    if (!activeTabId) {
      reject(new Error("No active tab available"))
      return
    }

    chrome.tabs.sendMessage(activeTabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }

      resolve(response)
    })
  })
}

async function loadPageStatus() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    activeTabId = tab?.id ?? null

    const response = await sendTabMessage({ type: "GET_PAGE_STATUS" })

    if (!response?.supported) {
      setUnsupported()
      return
    }

    pageSupported = true
    scanButton.disabled = false
    setStatus("Profile detected")
    setProfile(response)
  } catch (error) {
    setUnsupported()
  }
}

scanButton.addEventListener("click", async () => {
  if (!pageSupported) return

  scanButton.disabled = true
  resultEl.replaceChildren()
  setStatus("Scanning profile...")

  try {
    const response = await sendTabMessage({ type: "TRIGGER_SCAN" })

    if (!response?.success) {
      throw new Error(response?.error || "Scan failed")
    }

    renderResult(response.data)
    setStatus("Scan complete")
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Scan failed")
  } finally {
    scanButton.disabled = false
  }
})

historyButton.addEventListener("click", () => {
  chrome.tabs.create({ url: HISTORY_URL })
})

document.addEventListener("DOMContentLoaded", loadPageStatus)
