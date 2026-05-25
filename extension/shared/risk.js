function getRiskLevel(probability, confidence) {

    const score =
        probability * 100
    const resolvedConfidence =
        Number.isFinite(confidence)
            ? confidence
            : probability >= 0.5
                ? probability
                : 1 - probability

    if (resolvedConfidence < 0.60) {
        return {
            level: "Insufficient Evidence",
            color: "#64748b"
        }
    }

    if (score >= 70) {
        return {
            level: "Automated Threat",
            color: "#d93025"
        }
    }

    if (score >= 50) {
        return {
            level: "Suspicious Behavior",
            color: "#f9ab00"
        }
    }

    if (score >= 30) {
        return {
            level: "Low Risk",
            color: "#f9ab00"
        }
    }

    return {
        level: "Authentic Profile",
        color: "#188038"
    }
}
