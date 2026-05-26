function getText(selector) {
  return document.querySelector(selector)?.innerText || ""
}

function getTextFromSelectors(selectors) {
  for (const selector of selectors) {
    const text = getText(selector).trim()
    if (text) return text
  }

  return ""
}

function parseInstagramCount(text) {
  if (!text) return 0

  const normalized = text
    .replace(/,/g, "")
    .replace(/\s+/g, " ")
    .trim()
  const match = normalized.match(/([\d.]+)\s*([KkMmBb])?/)
  if (!match) return 0

  const value = Number(match[1])
  if (!Number.isFinite(value)) return 0

  const suffix = (match[2] || "").toUpperCase()
  if (suffix === "B") return Math.round(value * 1_000_000_000)
  if (suffix === "M") return Math.round(value * 1_000_000)
  if (suffix === "K") return Math.round(value * 1_000)

  return Math.round(value)
}

function getMetricByLabel(label) {
  const bodyText = document.body.innerText || ""
  const patterns = [
    new RegExp(`([\\d,.]+\\s*[KkMmBb]?)\\s+${label}`, "i"),
    new RegExp(`${label}\\s+([\\d,.]+\\s*[KkMmBb]?)`, "i")
  ]

  for (const pattern of patterns) {
    const match = bodyText.match(pattern)
    if (match) return parseInstagramCount(match[1])
  }

  return 0
}

function getMetric(label, selectors) {
  const text = getTextFromSelectors(selectors)
  const selectorValue = parseInstagramCount(text)
  if (selectorValue > 0) return selectorValue

  return getMetricByLabel(label)
}

function getInstagramBio() {
  return getTextFromSelectors([
    "header section div span",
    "header h1 ~ div span",
    "main header span",
    "section main header span"
  ])
}

function hasProfilePicture() {
  return Boolean(
    document.querySelector('header img[alt*="profile picture" i]') ||
    document.querySelector('header img[alt*="profile photo" i]') ||
    document.querySelector("main header img")
  )
}

function isVerifiedProfile() {
  const text = document.body.innerText || ""
  return (
    Boolean(document.querySelector('svg[aria-label="Verified"]')) ||
    Boolean(document.querySelector('[title="Verified"]')) ||
    /\bverified\b/i.test(text)
  )
}

function isInstagramProfilePath(username) {
  const reservedPaths = new Set([
    "accounts",
    "direct",
    "explore",
    "p",
    "reel",
    "reels",
    "stories"
  ])

  return Boolean(username) && !reservedPaths.has(username.toLowerCase())
}

async function extractInstagramProfile() {
  try {
    const username = document.location.pathname.split("/").filter(Boolean)[0] || ""

    if (!isInstagramProfilePath(username)) {
      return null
    }

    const followers = getMetric("followers", [
      `a[href="/${username}/followers/"]`,
      'a[href$="/followers/"]',
      'header a[href*="/followers"]',
      "header ul li:nth-child(2)"
    ])
    const following = getMetric("following", [
      `a[href="/${username}/following/"]`,
      'a[href$="/following/"]',
      'header a[href*="/following"]',
      "header ul li:nth-child(3)"
    ])
    const posts = getMetric("posts", [
      "header ul li:nth-child(1)",
      "main header ul li:nth-child(1)"
    ])
    const bio = getInstagramBio()
    const verified = isVerifiedProfile() ? 1 : 0
    const profilePicture = hasProfilePicture() ? 1 : 0

    return {
      platform: "instagram",
      rawMetrics: {
        username,
        followers,
        following,
        posts,
        verified,
        bio_length: bio.length,
        profile_picture: profilePicture,
        account_age_days: 365,
        username_randomness_score: calcRandomness(username),
        username_length: username.length
      }
    }
  } catch (error) {
    console.error(error)
    return null
  }
}

if (typeof globalThis !== "undefined") {
  globalThis.extractInstagramProfile = extractInstagramProfile
}
