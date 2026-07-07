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

function clamp(value, min, max) {
  return Math.min(
    Math.max(value, min),
    max
  )
}

const FEATURE_BOUNDS = {
  followers_count: [0, 1000000000],
  following_count: [0, 1000000],
  follower_following_ratio: [0, 1000],
  posts_per_day: [0, 500],
  content_density: [0, 500],
  tweets_per_day: [0, 500],
  engagement_proxy: [0, 100000000],
  activity_score: [0, 500],
  growth_signal: [0, 1000000]
}

function toFiniteNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

/**
 * Like toFiniteNumber but preserves null/undefined as null.
 * Use for fields where null means "genuinely unknown" so we never
 * silently coerce them to 0.
 */
function toNullableNumber(value) {
  if (value === null || value === undefined) return null
  return toFiniteNumber(value)
}

function roundFeature(value) {
  return Number.isFinite(value) ? +value.toFixed(4) : 0
}

function boundedFeature(value, field) {
  const [min, max] = FEATURE_BOUNDS[field]
  return clamp(value, min, max)
}

function buildMlPayload(rawProfile) {
  if (!rawProfile) return null

  // followers/following: null means genuinely unknown, NOT zero.
  // *ForCalc stand-ins are used only for derived-feature arithmetic.
  const followersRaw  = toNullableNumber(rawProfile.followers_count)
  const followingRaw  = toNullableNumber(rawProfile.following_count)
  const followers = followersRaw !== null
    ? boundedFeature(followersRaw, "followers_count")
    : null
  const following = followingRaw !== null
    ? boundedFeature(followingRaw, "following_count")
    : null
  const followersForCalc = followers ?? 0
  const followingForCalc = following ?? 0

  // account_age_days: null means unknown; send null so backend fills -1
  const accountAgeDays = rawProfile.account_age_days !== null && rawProfile.account_age_days !== undefined
    ? Math.max(0, toFiniteNumber(rawProfile.account_age_days))
    : null
  const ageDenominator = accountAgeDays !== null ? accountAgeDays : 0

  const statuses = Math.max(0, toFiniteNumber(rawProfile.statuses_count))
  const hasProfileImage = clamp(toFiniteNumber(rawProfile.has_profile_image), 0, 1)
  const verified = clamp(toFiniteNumber(rawProfile.verified), 0, 1)

  // bio_length: null means unknown; send null so backend fills -1
  const bioLength = rawProfile.bio_length !== null && rawProfile.bio_length !== undefined
    ? Math.max(0, toFiniteNumber(rawProfile.bio_length))
    : null

  const usernameRandomnessScore = toFiniteNumber(rawProfile.username_randomness_score)
  const usernameLength = Math.max(0, toFiniteNumber(rawProfile.username_length))

  const followerFollowingRatio =
    roundFeature(
      boundedFeature(
        followersForCalc / (followingForCalc + 1),
        "follower_following_ratio"
      )
    )
  const postsPerDay = roundFeature(
    boundedFeature(
      statuses / (ageDenominator + 1),
      "posts_per_day"
    )
  )
  const contentDensity = roundFeature(
    boundedFeature(
      statuses / Math.max(ageDenominator, 1),
      "content_density"
    )
  )
  const tweetsPerDay = roundFeature(
    boundedFeature(
      statuses / (ageDenominator + 1),
      "tweets_per_day"
    )
  )
  const engagementProxy = roundFeature(
    boundedFeature(
      followersForCalc * tweetsPerDay,
      "engagement_proxy"
    )
  )
  const followersLog = roundFeature(Math.log1p(followersForCalc))
  const followingLog = roundFeature(Math.log1p(followingForCalc))
  const ratioLog = roundFeature(followersLog / (followingLog + 1))
  const activityScore = roundFeature(
    boundedFeature(
      statuses / (ageDenominator + 1),
      "activity_score"
    )
  )
  const growthSignal = roundFeature(
    boundedFeature(
      followersForCalc / (ageDenominator + 1),
      "growth_signal"
    )
  )

  const followersKnown = followers !== null
  const followingKnown = following !== null
  const dataComplete   = followersKnown && followingKnown

  return {
    platform: "twitter",
    username: rawProfile.username || "",
    // ── core counts: null means genuinely unknown, not zero ──────────────
    followers_count: followers,   // null if extractor could not read it
    following_count: following,   // null if extractor could not read it
    // ── data-quality flags for the backend/model ─────────────────────────
    data_complete:   dataComplete,
    followers_known: followersKnown,
    following_known: followingKnown,
    // ── derived features ─────────────────────────────────────────────────
    follower_following_ratio: followerFollowingRatio,
    account_age_days: accountAgeDays,
    statuses_count: statuses,
    posts_per_day: postsPerDay,
    content_density: contentDensity,
    tweets_per_day: tweetsPerDay,
    engagement_proxy: engagementProxy,
    followers_log: followersLog,
    following_log: followingLog,
    ratio_log: ratioLog,
    activity_score: activityScore,
    growth_signal: growthSignal,
    has_profile_image: hasProfileImage,
    verified,
    bio_length: bioLength,
    username_randomness_score: usernameRandomnessScore,
    username_length: usernameLength
  }
}

if (typeof globalThis !== "undefined") {
  globalThis.ML_FEATURE_FIELDS = ML_FEATURE_FIELDS
  globalThis.buildMlPayload = buildMlPayload
}
