const DEFAULT_PREDICT_URL = "https://smart-fake-profile-detection.onrender.com/predict"

export const AI_API_BASE_URL = (
  import.meta.env.VITE_AI_API_URL || DEFAULT_PREDICT_URL
).replace(/\/predict\/?$/, "")

async function fetchJson(path) {
  const response = await fetch(`${AI_API_BASE_URL}${path}`)

  if (!response.ok) {
    throw new Error(`API request failed (${response.status})`)
  }

  return response.json()
}

export function fetchModelMetrics() {
  return fetchJson("/metrics")
}

export function fetchFeatureImportance() {
  return fetchJson("/feature-importance")
}

export function fetchModelInfo() {
  return fetchJson("/model-info")
}
