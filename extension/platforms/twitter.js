/**
 * twitter.js
 *
 * Platform adapter for twitter.com / x.com.
 *
 * Responsibilities:
 *  1. Wait for the profile to be ready using MutationObserver.
 *  2. Delegate raw extraction to extractor.js (extractTwitterRaw).
 *  3. Delegate normalization to normalizer.js (normalizeRawProfile).
 *  4. Return { platform, rawMetrics } consumed by featureEngineering.js.
 */

function waitForTwitterProfile(username) {
  return new Promise((resolve) => {
    function isReady() {
      return (
        Boolean(document.querySelector('[data-testid="UserName"]')) &&
        Boolean(document.querySelector(`a[href*="/${username}/followers"], a[href*="/followers"]`)) &&
        Boolean(document.querySelector(`a[href*="/${username}/following"], a[href*="/following"]`))
      )
    }

    if (isReady()) {
      resolve()
      return
    }

    const observer = new MutationObserver(() => {
      if (isReady()) {
        observer.disconnect()
        resolve()
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })
  })
}

async function extractTwitterProfile() {
  try {
    const username = window.location.pathname.split("/").filter(Boolean)[0] || ""
    if (!username) return null

    await waitForTwitterProfile(username)

    // Raw extraction (DOM text only)
    const raw = extractTwitterRaw()
    if (!raw) return null

    // Normalization (text → ML-safe numbers)
    const normalized = normalizeRawProfile(raw)
    if (!normalized) return null

    // Shape expected by featureEngineering.js → buildMlPayload
    return {
      platform:   "twitter",
      rawMetrics: {
        username:                  normalized.username,
        followers:                 normalized.followers,
        following:                 normalized.following,
        posts:                     normalized.posts,
        statuses:                  normalized.posts,
        verified:                  normalized.verified,
        bio_length:                normalized.bio_length,
        profile_picture:           normalized.has_profile_image,
        // null if join date not found; backend fills with -1 via fillna(-1)
        account_age_days:          normalized.account_age_days,
        username_randomness_score: normalized.username_randomness_score,
        username_length:           normalized.username_length
      }
    }
  } catch (error) {
    console.error("[FPD:twitter] Extraction failed:", error)
    return null
  }
}

// Legacy alias for content.js
if (typeof globalThis !== "undefined") {
  globalThis.extractTwitterProfile  = extractTwitterProfile
  globalThis.extractProfileData     = extractTwitterProfile
}
