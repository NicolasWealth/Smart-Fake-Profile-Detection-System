/**
 * predictor.js
 *
 * ONLY API communication.
 * Receives a normalized profile object (from normalizer.js),
 * fires the /predict endpoint, and returns the raw API response.
 *
 * No DOM access. No parsing. No UI.
 */

async function callPredictApi(normalizedProfile) {
  if (!normalizedProfile) {
    throw new Error("[FPD:predictor] normalizedProfile is null — cannot call predict API")
  }

  // Resolve API base URL from extension config
  const apiBase =
    (typeof FPD_CONFIG !== "undefined" && FPD_CONFIG.API_BASE_URL) ||
    "http://localhost:8000"

  const endpoint = `${apiBase}/predict`

  // Build the ML payload the backend expects
  const payload = buildMlPayload({ rawMetrics: normalizedProfile, platform: normalizedProfile.platform })

  if (!payload) {
    throw new Error("[FPD:predictor] buildMlPayload returned null")
  }

  console.log("[FPD:predictor] Sending to", endpoint, payload)

  const response = await fetch(endpoint, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload)
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => "")
    throw new Error(`[FPD:predictor] HTTP ${response.status}: ${errorText}`)
  }

  const result = await response.json()
  console.log("[FPD:predictor] Response:", result)
  return result
}

if (typeof globalThis !== "undefined") {
  globalThis.callPredictApi = callPredictApi
}
