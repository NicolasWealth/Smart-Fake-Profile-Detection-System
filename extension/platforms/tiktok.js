/**
 * tiktok.js
 *
 * Platform adapter for tiktok.com.
 *
 * Responsibilities:
 *  1. Wait for the profile header/main profile shell to exist (MutationObserver, no fixed delays).
 *  2. Delegate all raw extraction to extractor.js (extractTikTokRaw).
 *  3. Delegate normalization to normalizer.js (normalizeRawProfile).
 *  4. Return a { platform, rawMetrics } object consumed by featureEngineering.js.
 */

function waitForTikTokProfile() {
  return new Promise((resolve) => {
    if (
      document.querySelector('[data-e2e="user-page"]') ||
      document.querySelector('[data-e2e="user-info"]') ||
      document.querySelector("main")
    ) {
      resolve()
      return
    }

    const observer = new MutationObserver(() => {
      if (
        document.querySelector('[data-e2e="user-page"]') ||
        document.querySelector('[data-e2e="user-info"]') ||
        document.querySelector("main")
      ) {
        observer.disconnect()
        resolve()
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })
  })
}

async function extractTikTokProfile() {
  try {
    await waitForTikTokProfile()

    const raw = extractTikTokRaw()
    if (!raw) return null

    const normalized = normalizeRawProfile(raw)
    if (!normalized) return null

    return {
      platform:   "tiktok",
      rawMetrics: {
        username:                  normalized.username,
        followers:                 normalized.followers,
        following:                 normalized.following,
        posts:                     normalized.posts,
        likes_count:               normalized.likes_count,
        verified:                  normalized.verified,
        bio_length:                normalized.bio_length,
        profile_picture:           normalized.has_profile_image,
        account_age_days:          null,
        username_randomness_score: normalized.username_randomness_score,
        username_length:           normalized.username_length
      }
    }
  } catch (error) {
    console.error("[FPD:tiktok] Extraction failed:", error)
    return null
  }
}

if (typeof globalThis !== "undefined") {
  globalThis.extractTikTokProfile = extractTikTokProfile
}
