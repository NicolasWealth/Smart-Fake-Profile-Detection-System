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

function extractTikTokUsernameFromPath(pathname) {
  const handle = pathname.split("/").filter(Boolean)[0] || ""
  return handle.startsWith("@") ? handle.slice(1) : ""
}

function extractRawTikTokFollowers() {
  return getRawTextFromSelectors([
    '[data-e2e="followers-count"]',
    'strong[title*="Followers" i]',
    'strong[aria-label*="Followers" i]'
  ])
}

function extractRawTikTokFollowing() {
  return getRawTextFromSelectors([
    '[data-e2e="following-count"]',
    'strong[title*="Following" i]',
    'strong[aria-label*="Following" i]'
  ])
}

function extractRawTikTokLikes() {
  return getRawTextFromSelectors([
    '[data-e2e="likes-count"]',
    '[data-e2e="hearts-count"]',
    'strong[title*="Likes" i]',
    'strong[aria-label*="Likes" i]'
  ])
}

function extractRawTikTokPosts() {
  return getRawTextFromSelectors([
    '[data-e2e="videos-count"]',
    '[data-e2e="video-count"]',
    'strong[title*="Videos" i]',
    'strong[aria-label*="Videos" i]'
  ])
}

function extractTikTokBioFromMetaDescription() {
  const descriptions = [
    document.querySelector('meta[property="og:description"]')?.content,
    document.querySelector('meta[name="description"]')?.content,
    document.querySelector('meta[name="twitter:description"]')?.content
  ]

  for (const description of descriptions) {
    const text = (description || "").trim()
    const match = text.match(
      /\b[\d,.]+[KMB]?\s+Followers,\s*[\d,.]+[KMB]?\s+Following,\s*[\d,.]+[KMB]?\s+Likes\s*-\s*(.+)$/i
    )
    const bio = match?.[1]?.trim()
    if (bio && !/^Watch awesome short videos created by\b/i.test(bio)) return bio
  }

  return null
}

function extractTikTokBioFromHydration() {
  const scripts = document.querySelectorAll("script")

  for (const script of scripts) {
    const text = (script.textContent || "").trim()
    if (!text || !text.includes('"webapp.user-detail"')) continue

    try {
      const data = JSON.parse(text)
      const signature = data?.__DEFAULT_SCOPE__?.["webapp.user-detail"]?.userInfo?.user?.signature
      if (signature && signature.trim()) return signature.trim()
    } catch {
      const match = text.match(/"webapp\.user-detail":\{"userInfo":\{"user":\{[\s\S]*?"signature":"((?:\\.|[^"\\])*)"/)
      if (match) {
        try {
          const signature = JSON.parse(`"${match[1]}"`)
          if (signature && signature.trim()) return signature.trim()
        } catch {
          if (match[1].trim()) return match[1].trim()
        }
      }
    }
  }

  return null
}

function extractRawTikTokBio() {
  const domBio = getRawTextFromSelectors([
    '[data-e2e="user-info"] [data-e2e="user-bio"]',
    'main [data-e2e="user-bio"]',
    '[data-e2e="user-bio"]',
    '[data-e2e="user-desc"]',
    '[data-e2e="user-info"] h2 ~ div'
  ])

  return domBio || extractTikTokBioFromMetaDescription() || extractTikTokBioFromHydration()
}

function extractTikTokDescriptionText() {
  const metaDescription =
    document.querySelector('meta[property="og:description"]')?.content ||
    document.querySelector('meta[name="description"]')?.content ||
    document.querySelector('meta[name="twitter:description"]')?.content

  if (metaDescription && metaDescription.trim()) return metaDescription.trim()

  const scripts = document.querySelectorAll("script")
  for (const script of scripts) {
    const text = script.textContent || ""
    const match = text.match(/"shareMeta":\{"title":"(?:\\.|[^"\\])*","desc":"((?:\\.|[^"\\])*)"/)
    if (match) {
      try {
        return JSON.parse(`"${match[1]}"`)
      } catch {
        return match[1]
      }
    }
  }

  return ""
}

function extractTikTokStatsFromMeta() {
  const description = extractTikTokDescriptionText()
  const match = description.match(
    /(?:^@\S+\s+)?([\d,.]+[KMB]?)\s+Followers,\s*([\d,.]+[KMB]?)\s+Following,\s*([\d,.]+[KMB]?)\s+Likes/i
  )

  if (!match) {
    return {
      rawFollowersText: null,
      rawFollowingText: null,
      rawLikesText: null
    }
  }

  return {
    rawFollowersText: match[1],
    rawFollowingText: match[2],
    rawLikesText: match[3]
  }
}

function extractTikTokRaw() {
  const initialPathname = document.location.pathname
  const username = extractTikTokUsernameFromPath(initialPathname)

  if (!username) return null

  const metaStats = extractTikTokStatsFromMeta()
  const domFollowersText = extractRawTikTokFollowers()
  const domFollowingText = extractRawTikTokFollowing()
  const domLikesText     = extractRawTikTokLikes()
  const domPostsText     = extractRawTikTokPosts()
  const validDomFollowersText = looksLikeCountText(domFollowersText) ? domFollowersText : null
  const validDomFollowingText = looksLikeCountText(domFollowingText) ? domFollowingText : null
  const validDomLikesText     = looksLikeCountText(domLikesText) ? domLikesText : null
  const validDomPostsText     = looksLikeCountText(domPostsText) ? domPostsText : null
  const rejectedFollowersDomText = domFollowersText && !validDomFollowersText ? domFollowersText : null
  const rejectedFollowingDomText = domFollowingText && !validDomFollowingText ? domFollowingText : null
  const rejectedLikesDomText     = domLikesText && !validDomLikesText ? domLikesText : null
  const rejectedPostsDomText     = domPostsText && !validDomPostsText ? domPostsText : null
  const rawFollowersText = validDomFollowersText || metaStats.rawFollowersText
  const rawFollowingText = validDomFollowingText || metaStats.rawFollowingText
  const rawLikesText     = validDomLikesText || metaStats.rawLikesText
  const rawPostsText     = validDomPostsText
  const rawBio           = extractRawTikTokBio()
  const rawFollowersSource = validDomFollowersText ? "dom" : (metaStats.rawFollowersText ? "meta" : null)
  const rawFollowingSource = validDomFollowingText ? "dom" : (metaStats.rawFollowingText ? "meta" : null)
  const rawLikesSource     = validDomLikesText ? "dom" : (metaStats.rawLikesText ? "meta" : null)
  const rawPostsSource     = validDomPostsText ? "dom" : null

  if (document.location.pathname !== initialPathname) return null

  console.log("[FPD:extractor] TikTok raw extraction:", {
    username,
    rawFollowersText,
    rawFollowersSource,
    rejectedFollowersDomText,
    rawFollowingText,
    rawFollowingSource,
    rejectedFollowingDomText,
    rawLikesText,
    rawLikesSource,
    rejectedLikesDomText,
    rawPostsText,
    rawPostsSource,
    rejectedPostsDomText,
    rawBio
  })

  return {
    platform:        "tiktok",
    username,
    rawFollowersText,
    rawFollowingText,
    rawLikesText,
    rawPostsText,
    rawBio,
    hasProfilePicture: Boolean(
      document.querySelector('[data-e2e="user-avatar"] img') ||
      document.querySelector('img[alt*="avatar" i]') ||
      document.querySelector('main img[src*="avatar"]')
    ),
    isVerified: (
      Boolean(document.querySelector('[data-e2e="user-verified"]')) ||
      Boolean(document.querySelector('svg[aria-label*="Verified" i]')) ||
      Boolean(document.querySelector('[title*="Verified" i]'))
    )
  }
}

// --- Facebook ---------------------------------------------------------------

const FACEBOOK_RESERVED_PATHS = new Set([
  "about", "bookmarks", "events", "friends", "groups", "gaming", "help",
  "home", "marketplace", "messages", "notifications", "pages", "photo",
  "photos", "profile.php", "reel", "reels", "search", "settings", "stories",
  "watch"
])

function extractFacebookIdentifier() {
  const pathParts = document.location.pathname.split("/").filter(Boolean)
  const firstPathPart = pathParts[0] || ""

  if (firstPathPart === "profile.php") {
    const id = new URLSearchParams(document.location.search).get("id") || ""
    return /^\d+$/.test(id) ? id : ""
  }

  if (firstPathPart === "people") {
    return pathParts[1] || ""
  }

  if (!firstPathPart || FACEBOOK_RESERVED_PATHS.has(firstPathPart.toLowerCase())) return ""

  return firstPathPart
}

function extractFacebookCountFromText(text) {
  const match = (text || "").match(/([\d,.]+[KMB]?)\s*(?:followers?|following|friends?)\b/i)
  const countText = (match?.[1] || "").trim()
  return looksLikeCountText(countText) ? countText : null
}

const FACEBOOK_REJECTED_BIO_PHRASES = new Set([
  "see all photos",
  "photos",
  "see all friends",
  "see all",
  "edit bio",
  "add bio",
  "edit details",
  "add details",
  "intro",
  "following",
  "followers",
  "friends"
])

let rejectedFacebookBioText = null

function extractRawFacebookFriends() {
  const bodyText = document.body?.innerText || ""
  const matches = bodyText.match(/([\d,.]+\s?[KMB]?)\s*Friends\b/gi)
  const firstMatch = matches?.[0] || ""
  const countText = (firstMatch.match(/^([\d,.]+\s?[KMB]?)/i)?.[1] || "")
    .replace(/\s+/g, "")
    .trim()

  if (looksLikeCountText(countText)) return countText

  return null
}

function extractRawFacebookLinkedCount(kind) {
  const selectors = [
    `a[role="link"][href*="/${kind}/"]`,
    `a[href*="/${kind}/"]`,
    `a[role="link"][href$="/${kind}"]`,
    `a[href$="/${kind}"]`
  ]

  for (const selector of selectors) {
    const links = document.querySelectorAll(selector)

    for (const link of links) {
      const linkText = (link.innerText || link.textContent || "").trim()
      if (!new RegExp(`\\b${kind}\\b`, "i").test(linkText)) continue

      const strongText = (link.querySelector("strong")?.innerText || link.querySelector("strong")?.textContent || "")
        .trim()
      if (looksLikeCountText(strongText)) return strongText

      const countText = extractFacebookCountFromText(linkText)
      if (countText) return countText
    }
  }

  return null
}

function extractRawFacebookFollowers() {
  return extractRawFacebookLinkedCount("followers")
}

function extractRawFacebookFollowing() {
  return extractRawFacebookLinkedCount("following")
}

function normalizeFacebookBioRejectionText(text) {
  return (text || "")
    .replace(/\u00a0/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^[\s:;,.!?()[\]{}"'`]+|[\s:;,.!?()[\]{}"'`]+$/g, "")
    .toLowerCase()
}

function isRejectedFacebookBioText(text) {
  const trimmedText = (text || "").trim()
  if (!trimmedText) return false

  if (FACEBOOK_REJECTED_BIO_PHRASES.has(normalizeFacebookBioRejectionText(trimmedText))) {
    return true
  }

  const lines = trimmedText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  return (
    lines.length > 0 &&
    lines.every((line) => FACEBOOK_REJECTED_BIO_PHRASES.has(normalizeFacebookBioRejectionText(line)))
  )
}

function looksLikeRealFacebookBioText(text) {
  const trimmedText = (text || "").trim()
  if (trimmedText.length < 15) return false

  const hasLongWord = trimmedText
    .split(/\s+/)
    .some((word) => /[\p{L}]{4,}/u.test(word))

  if (!hasLongWord) return false

  const hasSentencePunctuation = /[.,!?]/.test(trimmedText)
  const lines = trimmedText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
  const isBareSingleWordList = (
    lines.length > 0 &&
    !hasSentencePunctuation &&
    lines.every((line) => /^\S+$/.test(line))
  )

  return !isBareSingleWordList
}

function shouldRejectFacebookBioText(text) {
  return isRejectedFacebookBioText(text) || !looksLikeRealFacebookBioText(text)
}

function cleanFacebookIntroText(text) {
  const rawLines = (text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  if (!rawLines.length) return null

  const rawCandidateText = rawLines.join("\n")
  if (shouldRejectFacebookBioText(rawCandidateText)) {
    rejectedFacebookBioText = rawCandidateText
    return null
  }

  const lines = rawLines
    .filter((line) => !/^(intro|about|edit details|add bio|details about you)$/i.test(line))

  if (!lines.length) return null

  const candidateText = lines.join("\n")
  if (shouldRejectFacebookBioText(candidateText)) {
    rejectedFacebookBioText = candidateText
    return null
  }

  return candidateText
}

function extractRawFacebookBio() {
  rejectedFacebookBioText = null
  const root = document.querySelector('div[role="main"]') || document.body
  const elements = [root, ...root.querySelectorAll("*")]

  function isVisibleElement(el) {
    const style = window.getComputedStyle(el)
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.visibility !== "collapse" &&
      style.opacity !== "0" &&
      el.getClientRects().length > 0
    )
  }

  function rawVisibleText(el) {
    return (el?.innerText || el?.textContent || "").replace(/\u00a0/g, " ").trim()
  }

  function normalizedText(el) {
    return rawVisibleText(el).replace(/\s+/g, " ").trim()
  }

  function isButtonLikeText(text) {
    return /^(edit details|add bio|add details|edit bio|details about you)$/i.test(text)
  }

  function cleanMeaningfulText(text) {
    const cleanedText = cleanFacebookIntroText(text)
    if (!cleanedText) return null

    const lines = cleanedText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !/^intro$/i.test(line))
      .filter((line) => !isButtonLikeText(line))

    return lines.length ? lines.join("\n") : null
  }

  function hasChildWithSameText(el, text) {
    return [...el.children]
      .filter(isVisibleElement)
      .some((child) => normalizedText(child) === text)
  }

  function cleanTextAfterIntro(container) {
    const lines = rawVisibleText(container)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
    const introIndex = lines.findIndex((line) => /^intro$/i.test(line))

    if (introIndex >= 0) {
      return cleanMeaningfulText(lines.slice(introIndex + 1).join("\n"))
    }

    return null
  }

  function meaningfulTextFromContainer(container, introEl) {
    const descendants = [...container.querySelectorAll("*")]
    const introIndex = descendants.indexOf(introEl)

    for (const candidate of descendants.slice(introIndex + 1)) {
      if (!isVisibleElement(candidate)) continue
      if (candidate.contains(introEl) || introEl.contains(candidate)) continue

      const text = normalizedText(candidate)
      if (!text || text.length > 300) continue
      if (/^intro$/i.test(text) || isButtonLikeText(text)) continue
      if (hasChildWithSameText(candidate, text)) continue

      const cleanedText = cleanMeaningfulText(rawVisibleText(candidate))
      if (cleanedText) return cleanedText
    }

    return cleanTextAfterIntro(container)
  }

  for (const el of elements) {
    if (!isVisibleElement(el)) continue
    if (!/^intro$/i.test(normalizedText(el))) continue

    let container = el.parentElement
    for (let depth = 0; container && depth < 5; depth++) {
      const text = meaningfulTextFromContainer(container, el)
      if (text) {
        rejectedFacebookBioText = null
        return text
      }
      container = container.parentElement
    }
  }

  return null
}

function hasCurrentFacebookProfilePictureOverlay() {
  const root = document.querySelector('div[role="main"]') || document.body
  const overlays = root.querySelectorAll(
    'div[role="none"][data-visualcompletion="ignore"][style*="inset: 0px"]'
  )

  for (const overlay of overlays) {
    let container = overlay.parentElement

    for (let depth = 0; container && depth < 5; depth++) {
      if (
        container.querySelector('image, img') ||
        container.querySelector('svg[role="img"], svg image') ||
        container.querySelector('a[role="link"][href*="/photo"], a[role="link"][href*="photo.php"]')
      ) {
        return true
      }

      container = container.parentElement
    }
  }

  return false
}

function extractFacebookRaw() {
  try {
    const initialPathname = document.location.pathname
    const username = extractFacebookIdentifier()

    console.log("[FPD:extractor] Facebook identifier check:", {
      pathname: document.location.pathname,
      username
    })

    if (!username) return null

    const domFollowersText = extractRawFacebookFollowers()
    const domFollowingText = extractRawFacebookFollowing()
    const domFriendsText = extractRawFacebookFriends()
    const rawFollowersText = looksLikeCountText(domFollowersText) ? domFollowersText : null
    const rawFollowingText = looksLikeCountText(domFollowingText) ? domFollowingText : null
    const rawFriendsText = looksLikeCountText(domFriendsText) ? domFriendsText : null
    const rawBio = extractRawFacebookBio()
    const rejectedBioText = rawBio ? null : rejectedFacebookBioText

    console.log("[FPD:extractor] Facebook raw extraction:", {
      username,
      rawFollowersText,
      rawFollowingText,
      rawFriendsText,
      rejectedBioText,
      rawBio
    })

    if (!rawFollowersText && !rawFollowingText && !rawFriendsText && !rawBio) return null
    if (document.location.pathname !== initialPathname) return null

    return {
      platform: "facebook",
      username,
      rawFollowersText,
      rawFollowingText,
      rawFriendsText,
      rawBio,
      hasProfilePicture: Boolean(
        document.querySelector('div[role="main"] image') ||
        document.querySelector('div[role="main"] img[alt*="profile picture" i]') ||
        document.querySelector('div[role="main"] img[alt*="profile photo" i]') ||
        document.querySelector('image[href*="scontent"]') ||
        hasCurrentFacebookProfilePictureOverlay()
      ),
      isVerified: (
        Boolean(document.querySelector('[aria-label*="Verified" i]')) ||
        Boolean(document.querySelector('svg[aria-label*="Verified" i]')) ||
        Boolean(document.querySelector('[title*="Verified" i]'))
      )
    }
  } catch (error) {
    console.warn("[FPD:extractor] Facebook raw extraction skipped:", error)
    return null
  }
}

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
  globalThis.extractTikTokRaw    = extractTikTokRaw
  globalThis.extractFacebookRaw  = extractFacebookRaw
  globalThis.extractTwitterRaw   = extractTwitterRaw
}
