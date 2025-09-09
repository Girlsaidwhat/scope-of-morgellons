// components/SignedInHeader.js
// Unified signed-in header used across pages to match the Profile page.
// Layout: left nav links; right column with "Send feedback" ABOVE "Sign out".
// Spacing and sizes mirror Profile: top links mb=8, h1 size=28, divider margin "6px 0 12px".

import Link from "next/link";

export default function SignedInHeader({
  title,
  leftLinks = [],                 // [{ href, label }]
  onSignOut,                      // () => Promise<void>
  feedbackHref,                   // mailto:...
}) {
  // Exact spacing and sizes taken from Profile page
  const TOP_BAR_MB = 8;           // between top links and header
  const H1_FS = 28;               // header font size
  const H1_MB = 6;                // below header before divider
  const DIVIDER_M = "6px 0 12px"; // divider margins

  return (
    <>
      {/* Top links (left) + feedback/sign-out (right) */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: TOP_BAR_MB,
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {leftLinks.map((l) => (
            <Link
              key={`${l.href}|${l.label}`}
              href={l.href}
              style={{ textDecoration: "none", fontWeight: 600 }}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <a
            href={feedbackHref}
            style={{ fontSize: 12, textDecoration: "underline", color: "#334155" }}
            aria-label="Send feedback about this page"
          >
            Send feedback
          </a>
          <button
            onClick={onSignOut}
            aria-label="Sign out"
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              background: "#f8fafc",
              cursor: "pointer",
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
            title="Sign out"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Page header */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: H1_MB,
        }}
      >
        <h1 style={{ fontSize: H1_FS, margin: 0 }}>{title}</h1>
      </header>

      {/* Thin divider under header */}
      <div
        role="separator"
        aria-hidden="true"
        style={{ height: 1, background: "#e5e7eb", margin: DIVIDER_M }}
      />
    </>
  );
}
