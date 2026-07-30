/**
 * normalizer.js
 *
 * Converts raw extractor output into ML-safe numeric values.
 * Input:  raw object from extractor.js
 * Output: { followers, following, posts, bio_length, ratio, account_age_days, ... }
 *
 * Rules:
 *  - Use null for unknowns — NEVER fake defaults like 365 or 0.
 *  - The backend fills nulls with -1 via fillna(-1).
 *  - Log both raw text and parsed result for every metric so bugs are obvious.
 */

// ─── Count Parser ─────────────────────────────────────────────────────────────

/**
 * Parse a human-readable count string ("1.2M", "45K", "123,456") to an integer.
 * Returns null if the text is empty/unparseable — never returns a fake default.
 */
function parseCount(text) {
  if (!text) return null

  const cleaned = text
    .replace(/,/g, "")
    .trim()
    .toUpperCase()

  if (cleaned.includes("K")) {
    const n = parseFloat(cleaned)
    return isNaN(n) ? null : Math.round(n * 1_000)
  }

  if (cleaned.includes("M")) {
    const n = parseFloat(cleaned)
    return isNaN(n) ? null : Math.round(n * 1_000_000)
  }

  if (cleaned.includes("B")) {
    const n = parseFloat(cleaned)
    return isNaN(n) ? null : Math.round(n * 1_000_000_000)
  }

  const num = parseInt(cleaned, 10)
  return isNaN(num) ? null : num
}

// ─── Randomness ───────────────────────────────────────────────────────────────

function calcRandomness(username) {
  if (!username) return 0
  let unusual = 0
  for (const char of username) {
    if (/[0-9_]/.test(char)) unusual++
  }
  return +(unusual / username.length).toFixed(4)
}

// ─── Instagram Normalizer ─────────────────────────────────────────────────────

function normalizeInstagram(raw) {
  const { username, rawFollowersText, rawFollowingText, rawPostsText, rawBio } = raw

  const followers = parseCount(rawFollowersText)
  const following = parseCount(rawFollowingText)
  const posts     = parseCount(rawPostsText)

  // Bio: use layered extraction result; null if unknown
  const cleanBio = rawBio ? rawBio.trim() : ""
  const bio_length = cleanBio.length > 0 ? cleanBio.length : null

  // Log raw vs parsed for debugging
  console.log("[FPD:normalizer] Instagram parsed:", {
    rawFollowersText,  followers,
    rawFollowingText,  following,
    rawPostsText,      posts,
    rawBio,            bio_length
  })

  // Ratio: log scale, null if either count unknown
  let ratio = null
  if (followers !== null && following !== null) {
    ratio = +Math.log10((followers + 1) / (following + 1)).toFixed(4)
  }

  return {
    platform:                  "instagram",
    username,
    followers,
    following,
    posts,
    ratio,
    bio_length,
    // account_age_days intentionally null — Instagram doesn't expose join date
    account_age_days:          null,
    has_profile_image:         raw.hasProfilePicture ? 1 : 0,
    verified:                  raw.isVerified ? 1 : 0,
    username_randomness_score: calcRandomness(username),
    username_length:           username.length
  }
}

// ─── Twitter Normalizer ───────────────────────────────────────────────────────

function normalizeTikTok(raw) {
  const { username, rawFollowersText, rawFollowingText, rawLikesText, rawPostsText, rawBio } = raw

  const followers = parseCount(rawFollowersText)
  const following = parseCount(rawFollowingText)
  const likes_count = parseCount(rawLikesText)
  const posts = parseCount(rawPostsText)

  const cleanBio = rawBio ? rawBio.trim() : ""
  const bio_length = cleanBio.length > 0 ? cleanBio.length : null

  console.log("[FPD:normalizer] TikTok parsed:", {
    rawFollowersText, followers,
    rawFollowingText, following,
    rawLikesText,     likes_count,
    rawPostsText,     posts,
    rawBio,           bio_length
  })

  let ratio = null
  if (followers !== null && following !== null) {
    ratio = +Math.log10((followers + 1) / (following + 1)).toFixed(4)
  }

  return {
    platform:                  "tiktok",
    username,
    followers,
    following,
    posts,
    likes_count,
    ratio,
    bio_length,
    account_age_days:          null,
    has_profile_image:         raw.hasProfilePicture ? 1 : 0,
    verified:                  raw.isVerified ? 1 : 0,
    username_randomness_score: calcRandomness(username),
    username_length:           username.length
  }
}

function normalizeFacebook(raw) {
  const { username, rawFollowersText, rawFollowingText, rawFriendsText, rawBio } = raw

  const parsedFollowers = parseCount(rawFollowersText)
  const parsedFollowing = parseCount(rawFollowingText)
  const friends_count = parseCount(rawFriendsText)
  const followers = parsedFollowers !== null ? parsedFollowers : friends_count
  const following = parsedFollowing !== null ? parsedFollowing : friends_count
  const cleanBio = rawBio ? rawBio.trim() : ""
  const bio_length = cleanBio.length > 0 ? cleanBio.length : null

  console.log("[FPD:normalizer] Facebook parsed:", {
    rawFollowersText, parsedFollowers,
    rawFollowingText, parsedFollowing,
    rawFriendsText, friends_count,
    rawBio,         bio_length
  })

  // Ratio: log scale, null if either count unknown
  let ratio = null
  if (followers !== null && following !== null) {
    ratio = +Math.log10((followers + 1) / (following + 1)).toFixed(4)
  }

  return {
    platform: "facebook",
    username,
    followers,
    following,
    friends_count,
    posts: null,
    ratio,
    bio_length,
    account_age_days: null,
    has_profile_image: raw.hasProfilePicture ? 1 : 0,
    verified: raw.isVerified ? 1 : 0,
    username_randomness_score: calcRandomness(username),
    username_length: username.length
  }
}

function normalizeTwitter(raw) {
  const { username, rawFollowersText, rawFollowingText, rawPostsText, rawBio, rawJoinedDate } = raw

  const followers = parseCount(rawFollowersText)
  const following = parseCount(rawFollowingText)
  const posts     = parseCount(rawPostsText)

  const cleanBio = rawBio ? rawBio.trim() : ""
  const bio_length = cleanBio.length > 0 ? cleanBio.length : null

  // Account age from join date — null if unavailable
  let account_age_days = null
  if (rawJoinedDate) {
    const parsed = new Date(rawJoinedDate)
    if (!isNaN(parsed.getTime())) {
      account_age_days = Math.max(
        Math.floor((Date.now() - parsed.getTime()) / 86_400_000),
        1
      )
    }
  }

  // Ratio: log scale
  let ratio = null
  if (followers !== null && following !== null) {
    ratio = +Math.log10((followers + 1) / (following + 1)).toFixed(4)
  }

  console.log("[FPD:normalizer] Twitter parsed:", {
    rawFollowersText,  followers,
    rawFollowingText,  following,
    rawPostsText,      posts,
    rawBio,            bio_length,
    rawJoinedDate,     account_age_days,
    ratio
  })

  return {
    platform:                  "twitter",
    username,
    followers,
    following,
    posts,
    ratio,
    bio_length,
    account_age_days,
    has_profile_image:         raw.hasProfilePicture ? 1 : 0,
    verified:                  raw.isVerified ? 1 : 0,
    username_randomness_score: calcRandomness(username),
    username_length:           username.length
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

function normalizeRawProfile(rawExtracted) {
  if (!rawExtracted) return null

  if (rawExtracted.platform === "instagram") return normalizeInstagram(rawExtracted)
  if (rawExtracted.platform === "tiktok")    return normalizeTikTok(rawExtracted)
  if (rawExtracted.platform === "facebook")  return normalizeFacebook(rawExtracted)
  if (rawExtracted.platform === "twitter")   return normalizeTwitter(rawExtracted)

  return null
}

if (typeof globalThis !== "undefined") {
  globalThis.parseCount         = parseCount
  globalThis.calcRandomness     = calcRandomness
  globalThis.normalizeRawProfile = normalizeRawProfile
}
