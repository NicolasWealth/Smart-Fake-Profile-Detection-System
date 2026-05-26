/**
 * featureEngineering.js
 *
 * Converts a normalized profile object into the final ML feature payload
 * sent to the /predict API.
 *
 * KEY RULE: Unknown values stay null here.
 * The backend (app.py) fills nulls with -1 via fillna(-1) before inference.
 * Never substitute fake defaults like 365 for account_age_days.
 */

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

const ML_FEATURE_FIELDS = [
  "followers_count",
  "following_count",
  "follower_following_ratio",
  "account_age_days",
  "statuses_count",
  "posts_per_day",
  "content_density",
  "tweets_per_day",
  "engagement_proxy",
  "followers_log",
  "following_log",
  "ratio_log",
  "activity_score",
  "growth_signal",
  "has_profile_image",
  "verified",
  "bio_length",
  "username_randomness_score",
  "username_length"
]

const FEATURE_BOUNDS = {
  followers_count:        [0, 1_000_000_000],
  following_count:        [0, 1_000_000],
  follower_following_ratio: [0, 1_000],
  posts_per_day:          [0, 500],
  content_density:        [0, 500],
  tweets_per_day:         [0, 500],
  engagement_proxy:       [0, 100_000_000],
  activity_score:         [0, 500],
  growth_signal:          [0, 1_000_000]
}

function toFiniteNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function calcRandomness(username) {
  if (!username) return 0
  let unusual = 0
  for (const char of username) {
    if (/[0-9_]/.test(char)) unusual++
  }
  return +(unusual / username.length).toFixed(4)
}

function normalizeBooleanMetric(value) {
  if (typeof value === "boolean") return value ? 1 : 0
  return clamp(toFiniteNumber(value), 0, 1)
}

function normalizeContentCount(metrics) {
  return toFiniteNumber(
    metrics.content_count ??
    metrics.posts ??
    metrics.statuses ??
    metrics.statuses_count
  )
}

function roundFeature(value) {
  return Number.isFinite(value) ? +value.toFixed(4) : 0
}

function boundedFeature(value, field) {
  const [min, max] = FEATURE_BOUNDS[field]
  return clamp(value, min, max)
}

/**
 * Unwrap rawMetrics from the platform object.
 * Accepts both { rawMetrics: {...} } and flat normalized objects.
 */
function normalizeExtractorOutput(rawProfile) {
  if (!rawProfile) return null

  if (rawProfile.rawMetrics && typeof rawProfile.rawMetrics === "object") {
    const m = rawProfile.rawMetrics
    return {
      platform:                  rawProfile.platform || "twitter",
      username:                  rawProfile.username || m.username || "",
      followers_count:           m.followers_count   ?? m.followers,
      following_count:           m.following_count   ?? m.following,
      // Preserve null — do NOT coerce to 0 or 365
      account_age_days:          m.account_age_days  ?? null,
      statuses_count:            normalizeContentCount(m),
      content_count:             normalizeContentCount(m),
      has_profile_image:         m.has_profile_image ?? m.profile_picture,
      verified:                  m.verified,
      // Preserve null — do NOT coerce to 0
      bio_length:                m.bio_length        ?? null,
      username_randomness_score: m.username_randomness_score,
      username_length:           m.username_length
    }
  }

  return rawProfile
}

function buildMlPayload(rawProfile) {
  const norm = normalizeExtractorOutput(rawProfile)
  if (!norm) return null

  const username = norm.username || ""

  const followers      = boundedFeature(toFiniteNumber(norm.followers_count), "followers_count")
  const following      = boundedFeature(toFiniteNumber(norm.following_count), "following_count")
  const contentCount   = Math.max(0, toFiniteNumber(norm.statuses_count || norm.content_count))
  const hasProfileImage = clamp(normalizeBooleanMetric(norm.has_profile_image), 0, 1)
  const verified       = clamp(normalizeBooleanMetric(norm.verified), 0, 1)
  const usernameRandomnessScore = toFiniteNumber(
    norm.username_randomness_score ?? calcRandomness(username)
  )
  const usernameLength = Math.max(0, toFiniteNumber(norm.username_length ?? username.length))

  // bio_length: null means unknown; send null so backend fills -1
  const bioLength = norm.bio_length !== null && norm.bio_length !== undefined
    ? Math.max(0, toFiniteNumber(norm.bio_length))
    : null

  // account_age_days: null means unknown; send null so backend fills -1
  const accountAgeDays = norm.account_age_days !== null && norm.account_age_days !== undefined
    ? Math.max(0, toFiniteNumber(norm.account_age_days))
    : null

  // For derived features that need account_age_days, treat null as 0 in denominator only
  const ageDenominator = accountAgeDays !== null ? accountAgeDays : 0

  // Ratio: use log10 scale as specified
  const followerFollowingRatio = roundFeature(
    boundedFeature(
      Math.log10((followers + 1) / (following + 1)),
      "follower_following_ratio"
    )
  )

  const postsPerDay    = roundFeature(boundedFeature(contentCount / (ageDenominator + 1), "posts_per_day"))
  const contentDensity = roundFeature(boundedFeature(contentCount / Math.max(ageDenominator, 1), "content_density"))
  const tweetsPerDay   = roundFeature(boundedFeature(contentCount / (ageDenominator + 1), "tweets_per_day"))
  const engagementProxy = roundFeature(boundedFeature(followers * tweetsPerDay, "engagement_proxy"))
  const followersLog   = roundFeature(Math.log1p(followers))
  const followingLog   = roundFeature(Math.log1p(following))
  const ratioLog       = roundFeature(followersLog / (followingLog + 1))
  const activityScore  = roundFeature(boundedFeature(contentCount / (ageDenominator + 1), "activity_score"))
  const growthSignal   = roundFeature(boundedFeature(followers / (ageDenominator + 1), "growth_signal"))

  console.log("[FPD:featureEngineering] Final ML payload:", {
    username,
    followers, following, accountAgeDays, bioLength,
    followerFollowingRatio, ratioLog, postsPerDay
  })

  return {
    platform:                  norm.platform || "twitter",
    username,
    raw_metrics:               { ...norm },
    followers_count:           followers,
    following_count:           following,
    follower_following_ratio:  followerFollowingRatio,
    account_age_days:          accountAgeDays,
    content_count:             contentCount,
    statuses_count:            contentCount,
    posts_per_day:             postsPerDay,
    content_density:           contentDensity,
    tweets_per_day:            tweetsPerDay,
    engagement_proxy:          engagementProxy,
    followers_log:             followersLog,
    following_log:             followingLog,
    ratio_log:                 ratioLog,
    activity_score:            activityScore,
    growth_signal:             growthSignal,
    has_profile_image:         hasProfileImage,
    verified,
    bio_length:                bioLength,
    username_randomness_score: usernameRandomnessScore,
    username_length:           usernameLength
  }
}

if (typeof globalThis !== "undefined") {
  globalThis.ML_FEATURE_FIELDS       = ML_FEATURE_FIELDS
  globalThis.calcRandomness          = calcRandomness
  globalThis.normalizeExtractorOutput = normalizeExtractorOutput
  globalThis.buildMlPayload          = buildMlPayload
}
