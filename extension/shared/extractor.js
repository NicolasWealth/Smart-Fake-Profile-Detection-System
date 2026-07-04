/**
 * extractor.js
 *
 * ONLY raw DOM extraction.
 * Output shape: { rawFollowersText, rawFollowingText, rawPostsText, rawBio, ... }
 * No parsing, no normalization, no ML logic.
 */

// ─── Instagram ────────────────────────────────────────────────────────────────

const INSTAGRAM_RESERVED_PATHS = new Set([
  "accounts", "direct", "explore", "p", "reel", "reels", "stories"
])

function isInstagramProfilePath(username) {
  return Boolean(username) && !INSTAGRAM_RESERVED_PATHS.has(username.toLowerCase())
}

function getRawTextFromSelectors(selectors) {
  for (const selector of selectors) {
    const el = document.querySelector(selector)
    const text = (el?.innerText || el?.textContent || "").trim()
    if (text) return text
  }
  return null
}

function looksLikeCountText(text) {
  if (!text) return false
  return /^\d+(?:,\d{3})*(?:\.\d+)?[KMB]?$/i.test(text.trim())
}

/**
 * Extract the raw Instagram bio text using layered fallbacks.
 * OG meta → structured header span → null (never fake-default).
 */
function extractRawInstagramBio() {
  const ogBio = document.querySelector('meta[property="og:description"]')?.content
  if (ogBio && ogBio.trim()) return ogBio.trim()

  const domBio = getRawTextFromSelectors([
    "header section div span",
    "header h1 ~ div span",
    "main header span",
    "section main header span"
  ])

  return domBio || null
}

function extractRawInstagramFollowers(username) {
  return getRawTextFromSelectors([
    `a[href="/${username}/followers/"]`,
    'a[href$="/followers/"]',
    'header a[href*="/followers"]',
    "header ul li:nth-child(2)"
  ])
}

function extractRawInstagramFollowing(username) {
  return getRawTextFromSelectors([
    `a[href="/${username}/following/"]`,
    'a[href$="/following/"]',
    'header a[href*="/following"]',
    "header ul li:nth-child(3)"
  ])
}

function extractInstagramStatsFromMeta() {
  const description = document.querySelector('meta[property="og:description"]')?.content || ""
  const match = description.match(
    /([\d,.]+[KM]?)\s+Followers,\s*([\d,.]+[KM]?)\s+Following,\s*([\d,.]+[KM]?)\s+Posts/i
  )

  if (!match) {
    return {
      rawFollowersText: null,
      rawFollowingText: null,
      rawPostsText: null
    }
  }

  return {
    rawFollowersText: match[1],
    rawFollowingText: match[2],
    rawPostsText: match[3]
  }
}

function extractRawInstagramPosts(username) {
  return getRawTextFromSelectors([
    "header ul li:nth-child(1)",
    "main header ul li:nth-child(1)"
  ])
}

function extractInstagramRaw() {
  const initialPathname = document.location.pathname
  const pathParts = initialPathname.split("/").filter(Boolean)
  if (/^[a-z]{2}$/.test(pathParts[0] || "")) pathParts.shift()
  const username = pathParts[0] || ""

  if (!isInstagramProfilePath(username)) return null

  const metaStats = extractInstagramStatsFromMeta()
  const domFollowersText = extractRawInstagramFollowers(username)
  const domFollowingText = extractRawInstagramFollowing(username)
  const domPostsText     = extractRawInstagramPosts(username)
  const validDomFollowersText = looksLikeCountText(domFollowersText) ? domFollowersText : null
  const validDomFollowingText = looksLikeCountText(domFollowingText) ? domFollowingText : null
  const validDomPostsText     = looksLikeCountText(domPostsText) ? domPostsText : null
  const rejectedFollowersDomText = domFollowersText && !validDomFollowersText ? domFollowersText : null
  const rejectedFollowingDomText = domFollowingText && !validDomFollowingText ? domFollowingText : null
  const rejectedPostsDomText     = domPostsText && !validDomPostsText ? domPostsText : null
  const rawFollowersText = validDomFollowersText || metaStats.rawFollowersText
  const rawFollowingText = validDomFollowingText || metaStats.rawFollowingText
  const rawPostsText     = validDomPostsText || metaStats.rawPostsText
  const rawBio           = extractRawInstagramBio()
  const rawFollowersSource = validDomFollowersText ? "dom" : (metaStats.rawFollowersText ? "meta" : null)
  const rawFollowingSource = validDomFollowingText ? "dom" : (metaStats.rawFollowingText ? "meta" : null)
  const rawPostsSource     = validDomPostsText ? "dom" : (metaStats.rawPostsText ? "meta" : null)

  if (document.location.pathname !== initialPathname) return null

  // Debug log: always show raw vs parsed expectation
  console.log("[FPD:extractor] Instagram raw extraction:", {
    username,
    rawFollowersText,
    rawFollowersSource,
    rejectedFollowersDomText,
    rawFollowingText,
    rawFollowingSource,
    rejectedFollowingDomText,
    rawPostsText,
    rawPostsSource,
    rejectedPostsDomText,
    rawBio
  })

  return {
    platform:        "instagram",
    username,
    rawFollowersText,
    rawFollowingText,
    rawPostsText,
    rawBio,
    hasProfilePicture: Boolean(
      document.querySelector('header img[alt*="profile picture" i]') ||
      document.querySelector('header img[alt*="profile photo" i]') ||
      document.querySelector("main header img")
    ),
    isVerified: (
      Boolean(document.querySelector('svg[aria-label="Verified"]')) ||
      Boolean(document.querySelector('[title="Verified"]')) ||
      /\bverified\b/i.test(document.body.innerText || "")
    )
  }
}

// ─── Twitter / X ─────────────────────────────────────────────────────────────

function isTwitterProfileReady(username) {
  if (!username) return false
  return (
    Boolean(document.querySelector('[data-testid="UserName"]')) &&
    Boolean(document.querySelector(`a[href*="/${username}/followers"], a[href*="/followers"]`)) &&
    Boolean(document.querySelector(`a[href*="/${username}/following"], a[href*="/following"]`))
  )
}

function extractRawTwitterStat(username, ...selectors) {
  return getRawTextFromSelectors(selectors) || null
}

function extractTwitterRaw() {
  const username = window.location.pathname.split("/").filter(Boolean)[0] || ""

  if (!isTwitterProfileReady(username)) {
    console.log("[FPD:extractor] Twitter profile not ready yet for:", username)
    return null
  }

  const rawFollowersText = extractRawTwitterStat(
    username,
    `a[href*="/${username}/verified_followers"]`,
    `a[href*="/${username}/followers"]`,
    `a[href*="/verified_followers"]`,
    `a[href*="/followers"]`
  )

  const rawFollowingText = extractRawTwitterStat(
    username,
    `a[href*="/${username}/following"]`,
    `a[href*="/following"]`
  )

  const rawPostsText = getRawTextFromSelectors([
    `a[href="/${username}"]`,
    `a[href*="/with_replies"]`
  ])

  const rawBio = document.querySelector('[data-testid="UserDescription"]')?.innerText?.trim() || null

  // Extract joined date for age calculation
  const joinedMatch = (document.body.innerText || "").match(/Joined\s+(\w+\s+\d{4})/)
  const rawJoinedDate = joinedMatch ? joinedMatch[1] : null

  console.log("[FPD:extractor] Twitter raw extraction:", {
    username,
    rawFollowersText,
    rawFollowingText,
    rawPostsText,
    rawBio,
    rawJoinedDate
  })

  return {
    platform:       "twitter",
    username,
    rawFollowersText,
    rawFollowingText,
    rawPostsText,
    rawBio,
    rawJoinedDate,
    hasProfilePicture: Boolean(document.querySelector('img[src*="profile_images"]')),
    isVerified:   Boolean(document.querySelector('[data-testid="icon-verified"]'))
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

if (typeof globalThis !== "undefined") {
  globalThis.extractInstagramRaw = extractInstagramRaw
  globalThis.extractTwitterRaw   = extractTwitterRaw
}
