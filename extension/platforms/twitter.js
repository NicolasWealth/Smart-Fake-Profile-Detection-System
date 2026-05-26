function parseCount(text) {
  if (!text) return 0
  const m = text.match(/([\d,]+(?:\.\d+)?)\s*([KkMmBb])?/)
  if (!m) return 0

  const num = parseFloat(m[1].replace(/,/g, ""))
  const suffix = (m[2] || "").toUpperCase()

  if (suffix === "M") return Math.round(num * 1_000_000)
  if (suffix === "K") return Math.round(num * 1_000)
  if (suffix === "B") return Math.round(num * 1_000_000_000)

  return Math.round(num) || 0
}

function getStatFromText(label) {
  const text = document.body.innerText
  const re = new RegExp(
    `([\\d,]+(?:\\.\\d+)?\\s*[KkMmBb]?)\\s*${label}`,
    "i"
  )
  const match = text.match(re)
  return match ? parseCount(match[1]) : 0
}

function getCountFromDOM(...selectors) {
  for (const selector of selectors) {
    const el = document.querySelector(selector)
    if (!el) continue

    const value = parseCount(el.innerText || "")
    if (value > 0) return value
  }

  return 0
}

function getStat(label, ...selectors) {
  const fromDOM = getCountFromDOM(...selectors)
  if (fromDOM > 0) return fromDOM
  return getStatFromText(label)
}

function calcRandomness(username) {
  if (!username) return 0

  let weird = 0
  for (const char of username) {
    if (/[0-9_]/.test(char)) weird++
  }

  return +(weird / username.length).toFixed(4)
}

function isProfileReady(username) {
  if (!username) return false

  const hasNameHeader = Boolean(document.querySelector('[data-testid="UserName"]'))
  const hasFollowersLink = Boolean(
    document.querySelector(
      `a[href*="/${username}/followers"], a[href*="/followers"]`
    )
  )
  const hasFollowingLink = Boolean(
    document.querySelector(
      `a[href*="/${username}/following"], a[href*="/following"]`
    )
  )

  return hasNameHeader && hasFollowersLink && hasFollowingLink
}

function extractTwitterProfile() {
  const username = window.location.pathname.split("/").filter(Boolean)[0] || ""

  if (!isProfileReady(username)) {
    return null
  }

  const followers = getStat(
    "Followers",
    `a[href*="/${username}/verified_followers"]`,
    `a[href*="/${username}/followers"]`,
    `a[href*="/verified_followers"]`,
    `a[href*="/followers"]`
  )

  const following = getStat(
    "Following",
    `a[href*="/${username}/following"]`,
    `a[href*="/following"]`
  )

  const statuses =
    getStatFromText("posts") ||
    getStat(
      "Posts",
      `a[href="/${username}"]`,
      `a[href*="/with_replies"]`
    )

  const bio =
    document.querySelector('[data-testid="UserDescription"]')?.innerText || ""

  const verified =
    document.querySelector('[data-testid="icon-verified"]') ? 1 : 0

  const profileImage =
    document.querySelector('img[src*="profile_images"]') ? 1 : 0

  let accountAgeDays = 365
  const joinedMatch = document.body.innerText.match(/Joined\s+(\w+\s+\d{4})/)
  if (joinedMatch) {
    const parsed = new Date(joinedMatch[1])
    if (!isNaN(parsed.getTime())) {
      accountAgeDays = Math.max(
        Math.floor((Date.now() - parsed.getTime()) / 86_400_000),
        1
      )
    }
  }

  console.log("[FPD] Extracted raw:", {
    platform: "twitter",
    username,
    followers,
    following,
    statuses,
    bio_length: bio.length,
    verified,
    profileImage,
    accountAgeDays
  })

  return {
    platform: "twitter",
    rawMetrics: {
      username,
      followers,
      following,
      posts: statuses,
      statuses,
      verified,
      bio_length: bio.length,
      profile_picture: profileImage,
      account_age_days: accountAgeDays,
      username_randomness_score: calcRandomness(username),
      username_length: username.length
    }
  }
}

if (typeof globalThis !== "undefined") {
  globalThis.parseCount = parseCount
  globalThis.getStat = getStat
  globalThis.getStatFromText = getStatFromText
  globalThis.calcRandomness = calcRandomness
  globalThis.extractTwitterProfile = extractTwitterProfile
  globalThis.extractProfileData = extractTwitterProfile
}
