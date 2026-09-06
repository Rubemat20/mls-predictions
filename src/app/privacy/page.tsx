import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — MLS Playoff Chances",
  description: "What data this site collects (and doesn't), and who processes it.",
};

const LAST_UPDATED = "September 6, 2026";

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px 80px" }}>
      <Link href="/" style={{ fontSize: 13, color: "var(--text-secondary)" }}>
        ← Back to the dashboard
      </Link>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginTop: 16, marginBottom: 4 }}>
        Privacy Policy
      </h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>
        Last updated {LAST_UPDATED}
      </p>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
          Short version
        </h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text-secondary)" }}>
          This site doesn&apos;t have accounts, doesn&apos;t use cookies, doesn&apos;t
          run analytics or tracking scripts, and doesn&apos;t store anything about
          you. It fetches public MLS standings and schedule data and shows you
          projections. That&apos;s it.
        </p>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
          What we collect
        </h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text-secondary)" }}>
          Nothing. There is no sign-up, no login, no forms, no cookies, and no
          analytics or advertising scripts anywhere on this site. We don&apos;t
          know who you are and have no way to identify you across visits.
        </p>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
          Hosting infrastructure
        </h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text-secondary)" }}>
          This site is hosted on{" "}
          <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">
            Vercel
          </a>
          , which, like any web host, processes standard server request logs
          (including IP addresses) as part of delivering the site to your
          browser. We don&apos;t receive or store that data ourselves — it&apos;s
          governed by Vercel&apos;s own privacy policy, linked above.
        </p>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
          Third-party data sources
        </h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text-secondary)" }}>
          Standings, schedules, and results are fetched from ESPN&apos;s public
          sports API. That request happens on our server, not your browser —
          ESPN never sees your IP address, and no information about you is
          ever sent to ESPN or any other third party.
        </p>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
          About the projection models
        </h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text-secondary)" }}>
          The playoff-probability models on this site (points pace, Monte
          Carlo simulation, Elo rating) are statistical calculations over
          public match data — team records, scores, and schedules. They do
          not process any personal or user data, and no AI/ML model is
          trained on or makes inferences about site visitors.
        </p>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
          Children&apos;s privacy
        </h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text-secondary)" }}>
          This site isn&apos;t directed at children and doesn&apos;t knowingly
          collect information from anyone, regardless of age — see
          &quot;What we collect&quot; above.
        </p>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
          Changes to this policy
        </h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text-secondary)" }}>
          If what this site collects ever changes, this page will be updated
          and the date at the top will change accordingly.
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Contact</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text-secondary)" }}>
          Questions about this policy: open an issue on{" "}
          <a
            href="https://github.com/Rubemat20/mls-predictions/issues"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          .
        </p>
      </section>
    </div>
  );
}
