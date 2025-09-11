// pages/index.js
// Logged-out: Landing view (public, anonymized tiles + simple nav + Sign in button).
// Logged-in: Home (Welcome + Profile + Gallery + CSV, unchanged behavior).

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const PAGE_SIZE = 24;
// Cache-bust marker for a fresh JS chunk
const INDEX_BUILD = "idx-36.703";

function prettyDate(s) {
  try {
    const d = new Date(s);
    return d.toLocaleString();
  } catch {
    return s || "";
  }
}

function Badge({ children }) {
  return (
    <span
      style={{
        fontSize: 12,
        padding: "2px 8px",
        border: "1px solid #ddd",
        borderRadius: 999,
      }}
    >
      {children}
    </span>
  );
}

// ---------------- Landing (public, anonymized) ----------------
function Landing() {
  const router = useRouter();
  const categories = [
    { key: "blebs", label: "Blebs (clear to brown)" },
    { key: "fibers", label: "Fibers" },
    { key: "bundles", label: "Fiber Bundles" },
    { key: "crystals", label: "Crystals / Particles" },
  ];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(
      () => setIdx((i) => (i + 1) % categories.length),
      3000
    );
    return () => clearInterval(t);
  }, []);

  return (
    <main
      id="main"
      tabIndex={-1}
      style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}
    >
      <nav
        aria-label="Main"
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 14,
          marginBottom: 12,
        }}
      >
        <a
          href="#about"
          style={{ textDecoration: "none" }}
          title="Learn about the project"
        >
          About
        </a>
        <a
          href="#news"
          style={{ textDecoration: "none" }}
          title="Latest updates"
        >
          News
        </a>
        <a
          href="#resources"
          style={{ textDecoration: "none" }}
          title="Helpful links"
        >
          Resources
        </a>
        <button
          onClick={() => router.push("/?auth=1")}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #1e293b",
            background: "#111827",
            color: "white",
            cursor: "pointer",
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
          aria-label="Sign in or create an account"
          title="Sign in / Sign up"
        >
          Sign in
        </button>
      </nav>

      <header style={{ textAlign: "center", margin: "20px 0 18px" }}>
        <h1 style={{ margin: 0, fontSize: 28 }}>The Scope of Morgellons</h1>
        <p style={{ margin: "8px 0 0", opacity: 0.9 }}>
          An anonymized visual catalog to help researchers and the curious
          understand patterns and categories.
        </p>
      </header>

      <section
        aria-label="Categories"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        {categories.map((c, i) => {
          const active = i === idx;
          return (
            <div
              key={c.key}
              role="img"
              aria-label={`Category ${c.label}`}
              style={{
                height: 140,
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                background: active
                  ? "radial-gradient(60% 60% at 50% 40%, #e5f3ff 0%, #eef2ff 70%, #f8fafc 100%)"
                  : "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 600,
              }}
              title={c.label}
            >
              {c.label}
            </div>
          );
        })}
      </section>
    </main>
  );
}

// ------------------------------------------------------------------------

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setUser(data?.session?.user ?? null);
      setAuthReady(true);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setUser(sess?.user ?? null);
      setAuthReady(true);
    });
    return () => sub.subscription?.unsubscribe?.();
  }, []);

  if (!authReady) return <main aria-busy="true" />;
  if (!user) return <Landing />;

  const firstName = useMemo(() => {
    const m = user?.user_metadata?.first_name?.trim();
    if (m) return m;
    const email = user?.email || "";
    const local = email.split("@")[0] || "";
    const piece = (local.split(/[._-]/)[0] || local).trim();
    return piece ? piece[0].toUpperCase() + piece.slice(1) : "";
  }, [user]);

  return (
    <main
      id="main"
      data-index-build={INDEX_BUILD}
      style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 20,
        }}
      >
        <h1 style={{ fontSize: 28 }}>
          {firstName
            ? `Welcome to Your Profile, ${firstName}`
            : "Welcome to Your Profile"}
        </h1>
        <div
          style={{
            width: 315,
            height: 429,
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <img
            src="/fill_in_your_story.jpg"
            alt="Fill in your story"
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        </div>
      </header>
    </main>
  );
}
