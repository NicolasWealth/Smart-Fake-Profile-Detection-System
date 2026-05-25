function generateExplanation(payload, result) {

    const reasons = []

    if (payload.follower_following_ratio >= 1000) {
        reasons.push(
            "Follower-to-following ratio is extreme enough to indicate non-organic audience acquisition patterns"
        )
    }

    if (payload.username_randomness_score > 0.4) {
        reasons.push(
            "Username structure contains randomness signals commonly seen in automated or disposable accounts"
        )
    }

    if (payload.has_profile_image === 0) {
        reasons.push(
            "Profile metadata lacks normal authenticity indicators, including a recognizable profile image"
        )
    }

    if (payload.bio_length < 10) {
        reasons.push(
            "Profile biography is too sparse to provide normal identity or context signals"
        )
    }

    if (payload.content_density > 50) {
        reasons.push(
            "Posting density significantly exceeds normal human activity baseline for the account age"
        )
    }

    if (payload.tweets_per_day > 50 ||
        payload.activity_score > 50) {
        reasons.push(
            "Daily posting frequency significantly exceeds normal human activity baseline"
        )
    }

    if (payload.growth_signal < 0.5 &&
        payload.account_age_days > 180) {
        reasons.push(
            "Follower growth is unusually weak relative to account age, which reduces account authenticity confidence"
        )
    }

    if (payload.engagement_proxy > 1000000 &&
        payload.verified === 0) {
        reasons.push(
            "Reach proxy is unusually large for an unverified account, creating a credibility mismatch"
        )
    }

    if (payload.ratio_log > 2.5 &&
        payload.following_count < 20) {
        reasons.push(
            "Follower graph is highly asymmetric, which can indicate artificial audience shaping"
        )
    }

    if (payload.verified === 0 &&
        payload.followers_count > 1000000) {
        reasons.push(
            "Large audience size without verification increases impersonation and automation risk"
        )
    }

    if (reasons.length === 0 &&
        (result.fake_probability || 0) >= 0.5) {
        reasons.push(
            "Multiple account signals deviate from the baseline profile of a typical authentic account"
        )
    }

    return {
        confidence:
            Math.round(
                (result.fake_probability || 0) * 100
            ),

        reasons
    }
}
