/**
 * facebook.js
 *
 * Platform adapter for facebook.com.
 *
 * Responsibilities:
 *  1. Wait for the profile header/main profile shell to exist (MutationObserver, no fixed delays).
 *  2. Delegate all raw extraction to extractor.js (extractFacebookRaw).
 *  3. Delegate normalization to normalizer.js (normalizeRawProfile).
 *  4. Return a { platform, rawMetrics } object consumed by featureEngineering.js.
 */

function waitForFacebookProfile() {
  return new Promise((resolve) => {
    let settled = false
    let observer = null

    function finish() {
      if (settled) return
      settled = true
      observer?.disconnect()
      resolve()
    }

    if (
      document.querySelector('div[role="main"]') ||
      document.querySelector("main")
    ) {
      finish()
      return
    }

    observer = new MutationObserver(() => {
      if (
        document.querySelector('div[role="main"]') ||
        document.querySelector("main")
      ) {
        finish()
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })
    setTimeout(finish, 8000)
  })
}

async function extractFacebookProfile() {
  try {
    console.log("[FPD:facebook] script injected, hostname:", location.hostname, "pathname:", location.pathname)
    await waitForFacebookProfile()

    const raw = extractFacebookRaw()
    if (!raw) return null

    const normalized = normalizeRawProfile(raw)
    if (!normalized) return null

    return {
      platform:   "facebook",
      rawMetrics: {
        username:                  normalized.username,
        followers:                 normalized.followers,
        following:                 normalized.following,
        friends_count:             normalized.friends_count,
        posts:                     normalized.posts,
        verified:                  normalized.verified,
        bio_length:                normalized.bio_length,
        profile_picture:           normalized.has_profile_image,
        account_age_days:          null,
        username_randomness_score: normalized.username_randomness_score,
        username_length:           normalized.username_length
      }
    }
  } catch (error) {
    console.error("[FPD:facebook] Extraction failed:", error)
    return null
  }
}

if (typeof globalThis !== "undefined") {
  globalThis.extractFacebookProfile = extractFacebookProfile
}
