/**
 * instagram.js
 *
 * Platform adapter for instagram.com.
 *
 * Responsibilities:
 *  1. Wait for the profile header to exist (MutationObserver — no fixed delays).
 *  2. Delegate all raw extraction to extractor.js (extractInstagramRaw).
 *  3. Delegate normalization to normalizer.js (normalizeRawProfile).
 *  4. Return a { platform, rawMetrics } object consumed by featureEngineering.js.
 */

function waitForInstagramProfile() {
  return new Promise((resolve) => {
    // Already in DOM?
    if (document.querySelector("header")) {
      resolve()
      return
    }

    const observer = new MutationObserver(() => {
      if (document.querySelector("header")) {
        observer.disconnect()
        resolve()
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })
  })
}

async function extractInstagramProfile() {
  try {
    await waitForInstagramProfile()

    // Raw extraction (DOM text only)
    const raw = extractInstagramRaw()
    if (!raw) return null

    // Normalization (text → ML-safe numbers, nulls for unknowns)
    const normalized = normalizeRawProfile(raw)
    if (!normalized) return null

    // Shape expected by featureEngineering.js → buildMlPayload
    return {
      platform:   "instagram",
      rawMetrics: {
        username:                  normalized.username,
        followers:                 normalized.followers,
        following:                 normalized.following,
        posts:                     normalized.posts,
        verified:                  normalized.verified,
        bio_length:                normalized.bio_length,
        profile_picture:           normalized.has_profile_image,
        // null → backend fills with -1 via fillna(-1)
        account_age_days:          null,
        username_randomness_score: normalized.username_randomness_score,
        username_length:           normalized.username_length
      }
    }
  } catch (error) {
    console.error("[FPD:instagram] Extraction failed:", error)
    return null
  }
}

if (typeof globalThis !== "undefined") {
  globalThis.extractInstagramProfile = extractInstagramProfile
}
