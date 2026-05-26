function clamp(value, min, max) {
  return Math.min(
    Math.max(value, min),
    max
  )
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

function calcRandomness(username) {
  if (!username) return 0

  let unusual = 0
  for (const char of username) {
    if (/[0-9_]/.test(char)) unusual++
  }

  return +(unusual / username.length).toFixed(4)
}

function normalizeBooleanMetric(value) {
  if (typeof value === "boolean") {
    return value ? 1 : 0
  }

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

function normalizeExtractorOutput(rawProfile) {
  if (!rawProfile) {
    return null
  }

  if (rawProfile.rawMetrics && typeof rawProfile.rawMetrics === "object") {
    const metrics = rawProfile.rawMetrics

    return {
      platform: rawProfile.platform || "twitter",
      username: rawProfile.username || metrics.username || "",
      followers_count: metrics.followers_count ?? metrics.followers,
      following_count: metrics.following_count ?? metrics.following,
      account_age_days: metrics.account_age_days,
      statuses_count: normalizeContentCount(metrics),
      content_count: normalizeContentCount(metrics),
      has_profile_image: metrics.has_profile_image ?? metrics.profile_picture,
      verified: metrics.verified,
      bio_length: metrics.bio_length,
      username_randomness_score: metrics.username_randomness_score,
      username_length: metrics.username_length
    }
  }

  return rawProfile
}

function buildMlPayload(rawProfile) {
  const normalizedProfile = normalizeExtractorOutput(rawProfile)
  if (!normalizedProfile) return null
  const username = normalizedProfile.username || ""

  const rawMetrics = {
    followers_count: toFiniteNumber(normalizedProfile.followers_count),
    following_count: toFiniteNumber(normalizedProfile.following_count),
    account_age_days: toFiniteNumber(normalizedProfile.account_age_days),
    statuses_count: toFiniteNumber(normalizedProfile.statuses_count),
    content_count: toFiniteNumber(normalizedProfile.content_count),
    has_profile_image: normalizeBooleanMetric(normalizedProfile.has_profile_image),
    verified: normalizeBooleanMetric(normalizedProfile.verified),
    bio_length: toFiniteNumber(normalizedProfile.bio_length),
    username_randomness_score: toFiniteNumber(
      normalizedProfile.username_randomness_score ?? calcRandomness(username)
    ),
    username_length: toFiniteNumber(
      normalizedProfile.username_length ?? username.length
    )
  }

  const followers = boundedFeature(
    rawMetrics.followers_count,
    "followers_count"
  )
  const following = boundedFeature(
    rawMetrics.following_count,
    "following_count"
  )
  const accountAgeDays = Math.max(0, rawMetrics.account_age_days)
  const contentCount = Math.max(
    0,
    rawMetrics.content_count || rawMetrics.statuses_count
  )
  const hasProfileImage = clamp(rawMetrics.has_profile_image, 0, 1)
  const verified = clamp(rawMetrics.verified, 0, 1)
  const bioLength = Math.max(0, rawMetrics.bio_length)
  const usernameRandomnessScore = rawMetrics.username_randomness_score
  const usernameLength = Math.max(0, rawMetrics.username_length)

  const followerFollowingRatio =
    roundFeature(
      boundedFeature(
        followers / (following + 1),
        "follower_following_ratio"
      )
    )
  const postsPerDay = roundFeature(
    boundedFeature(
      contentCount / (accountAgeDays + 1),
      "posts_per_day"
    )
  )
  const contentDensity = roundFeature(
    boundedFeature(
      contentCount / Math.max(accountAgeDays, 1),
      "content_density"
    )
  )
  const tweetsPerDay = roundFeature(
    boundedFeature(
      contentCount / (accountAgeDays + 1),
      "tweets_per_day"
    )
  )
  const engagementProxy = roundFeature(
    boundedFeature(
      followers * tweetsPerDay,
      "engagement_proxy"
    )
  )
  const followersLog = roundFeature(Math.log1p(followers))
  const followingLog = roundFeature(Math.log1p(following))
  const ratioLog = roundFeature(followersLog / (followingLog + 1))
  const activityScore = roundFeature(
    boundedFeature(
      contentCount / (accountAgeDays + 1),
      "activity_score"
    )
  )
  const growthSignal = roundFeature(
    boundedFeature(
      followers / (accountAgeDays + 1),
      "growth_signal"
    )
  )

  return {
    platform: normalizedProfile.platform || "twitter",
    username,
    raw_metrics: rawMetrics,
    followers_count: followers,
    following_count: following,
    follower_following_ratio: followerFollowingRatio,
    account_age_days: accountAgeDays,
    content_count: contentCount,
    statuses_count: contentCount,
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
  globalThis.calcRandomness = calcRandomness
  globalThis.normalizeExtractorOutput = normalizeExtractorOutput
  globalThis.buildMlPayload = buildMlPayload
}
