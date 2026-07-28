const sections = [
  {
    title: "What data we collect",
    body:
      "When you use the extension on a supported profile page, it reads publicly visible profile fields (such as username, bio text, follower/following counts, and post count) from the page you are viewing. It does not collect passwords, private messages, or any data outside the profile page you choose to scan."
  },
  {
    title: "How we use the data",
    body:
      "The extracted profile fields are sent to our backend API for feature processing and classification. The backend returns a prediction (genuine or fake) which is displayed to you in the extension and, if you choose, on the companion dashboard."
  },
  {
    title: "Where data is stored",
    body:
      "Scan results and predictions may be stored in our Supabase-hosted database so you can review your scan history on the dashboard. We do not sell this data or share it with advertisers or third parties."
  },
  {
    title: "Data retention",
    body:
      "Scan history is retained until you delete it or request account/data deletion. Contact us using the details below to request deletion."
  },
  {
    title: "Third parties",
    body:
      "We do not use the collected data for advertising. Our backend is hosted on Render and our database on Supabase, which process data on our behalf under their respective infrastructure terms."
  },
  {
    title: "Permissions",
    body:
      "The extension requests host permissions limited to instagram.com, tiktok.com, and facebook.com, solely to read profile content on pages you actively visit and scan. It does not run in the background or access other websites."
  },
  {
    title: "Your choices",
    body:
      "You can uninstall the extension at any time to stop all data collection. You may request deletion of any stored scan history by contacting us."
  }
]

const pageStyle = {
  minHeight: "100svh",
  background: "#f8fafc",
  color: "#111827",
  padding: "40px 20px"
}

const articleStyle = {
  width: "min(720px, 100%)",
  margin: "0 auto",
  lineHeight: 1.6
}

export default function PrivacyPolicy() {
  return (
    <main style={pageStyle}>
      <article style={articleStyle}>
        <h1 style={{ fontSize: "1.6rem", letterSpacing: 0, margin: "0 0 8px" }}>
          Privacy Policy - Fake Profile Detector
        </h1>
        <p style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: 24 }}>
          Last updated: July 27, 2026
        </p>

        <p style={{ color: "#1f2937", fontSize: "0.95rem" }}>
          Fake Profile Detector is a Chrome extension that analyzes social media profiles on
          Instagram, TikTok, and Facebook to identify likely fake or bot accounts using a machine
          learning model.
        </p>

        {sections.map((section) => (
          <section key={section.title}>
            <h2
              style={{
                color: "#111827",
                fontSize: "1.15rem",
                letterSpacing: 0,
                margin: "32px 0 8px"
              }}
            >
              {section.title}
            </h2>
            <p style={{ color: "#1f2937", fontSize: "0.95rem" }}>{section.body}</p>
          </section>
        ))}

        <section>
          <h2
            style={{
              color: "#111827",
              fontSize: "1.15rem",
              letterSpacing: 0,
              margin: "32px 0 8px"
            }}
          >
            Contact
          </h2>
          <p style={{ color: "#1f2937", fontSize: "0.95rem" }}>
            For privacy questions or data deletion requests, contact:{" "}
            <strong>[your email here]</strong>
          </p>
        </section>
      </article>
    </main>
  )
}
