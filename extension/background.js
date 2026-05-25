import { CONFIG } from "./config.js"

const { API_URL, SUPABASE_URL, SUPABASE_ANON_KEY: SUPABASE_KEY } = CONFIG
const SUPABASE_MAX_SCHEMA_RETRIES = 12

function getSupabaseHeaders() {
  return {
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`
  }
}

function getMissingSchemaColumn(errorText) {
  try {
    const parsed = JSON.parse(errorText)
    const message = parsed?.message || ""
    const match = message.match(/Could not find the '([^']+)' column/i)
    return match ? match[1] : null
  } catch {
    return null
  }
}

async function insertSupabaseScan(row) {
  const body = { ...row }

  for (let attempt = 0; attempt <= SUPABASE_MAX_SCHEMA_RETRIES; attempt++) {
    const sbRes = await fetch(`${SUPABASE_URL}/rest/v1/scans`, {
      method: "POST",
      headers: getSupabaseHeaders(),
      body: JSON.stringify(body)
    })

    if (sbRes.ok) {
      return {
        ok: true,
        body
      }
    }

    const errText = await sbRes.text()
    const missingColumn = getMissingSchemaColumn(errText)

    if (
      sbRes.status === 400 &&
      missingColumn &&
      Object.prototype.hasOwnProperty.call(body, missingColumn)
    ) {
      console.warn(`[FPD] Supabase schema missing '${missingColumn}', retrying without it`)
      delete body[missingColumn]
      continue
    }

    return {
      ok: false,
      status: sbRes.status,
      errorText: errText
    }
  }

  return {
    ok: false,
    status: 400,
    errorText: "Supabase schema retry limit reached"
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== "SCAN_PAGE") return false

  const scanId = crypto.randomUUID()
  const payloadWithScan = {
    ...msg.payload,
    scan_id: scanId
  }

  handleScanRequest(payloadWithScan)
    .then((data) => {
      sendResponse({
        success: true,
        data
      })
    })
    .catch((error) => {
      const message =
        error instanceof Error ? error.message : String(error)

      console.error("Scan error:", error)
      sendResponse({
        success: false,
        error: message
      })
    })

  return true
})

async function handleScanRequest(payload) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`AI service failed (${res.status}): ${errorText}`)
  }

  const result = await res.json()
  const serverSupabaseResult = result?.supabase
  let clientSupabaseResult = null

  const supabaseBody = {
    ...payload,
    scan_id: payload.scan_id,
    prediction: result.prediction,
    label: result.label,
    fake_probability: result.fake_probability || 0,
    confidence: result.confidence || 0,
    risk_level: result.risk_level || "Low",
    explanation: result.explanation || []
  }

  if (serverSupabaseResult?.ok) {
    console.log("[FPD] Supabase save OK on server for:", payload.username)
  } else {
    console.log("[FPD] Server did not save to Supabase, falling back to extension:", serverSupabaseResult)
    console.log("[FPD] Sending to Supabase:", supabaseBody)

    const supabaseResult = await insertSupabaseScan(supabaseBody)
    clientSupabaseResult = supabaseResult

    if (!supabaseResult.ok) {
      console.error("[FPD] Supabase error:", supabaseResult.status, supabaseResult.errorText)
    } else {
      console.log("[FPD] Supabase save OK for:", payload.username)
    }
  }

  if (serverSupabaseResult?.skipped) {
    console.warn("[FPD] Server-side Supabase insert skipped:", serverSupabaseResult.reason)
  } else {
    console.log("[FPD] Server-side Supabase result:", serverSupabaseResult)
  }

  result.supabase_saved = Boolean(serverSupabaseResult?.ok || clientSupabaseResult?.ok)
  result.client_supabase = clientSupabaseResult

  return result
}
