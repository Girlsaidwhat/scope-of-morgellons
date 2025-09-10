// pages/index.js
// TEMP PROFILE SHELL — NO IMAGE
// Purpose: isolate a stubborn image by removing any aside/img usage on the Profile page.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function IndexPage() {
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

  const firstName = useMemo(() => {
    const m = user?.user_metadata?.first_name?.trim();
    if (m) return m;
    const email = user?.email || "";
    const local = email.split("@")[0] || "";
    const piece = (local.split(/[._-]/)[0] || local).trim();
    return piece ? piece[0].toUpperCase() + piece.slice(1) : "";
  }, [user]);

  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
    } finally {
      router.push("/");
    }
  }

  if (!authReady) {
    return (
      <main id="main" tabIndex={-1} style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }} />
    );
  }

  // Logged-out minimal landing so the site remains usable
  if (!user) {
    return (
      <main id="main" tabIndex={-1} style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
        <header style={{ textAlign: "center", margin: "20px 0 18px" }}>
          <h1 style={{ margin: 0, fontSize: 28 }}>The Scope of Morgellons</h1>
          <p style={{ margin: "8px 0 0", opacity: 0.9 }}>
            Minimal landing while we debug the profile layout.
          </p>
        </header>

        <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
          <Link href="/signin" style={{ textDecoration: "none", fontWeight: 600 }}>
            Sign in
          </Link>
          <Link href="/browse" style={{ textDecoration: "none", fontWeight: 600 }}>
            Browse
          </Link>
        </div>
      </main>
    );
  }

  // Logged-in: TEMP PROFILE SHELL (no aside, no <img>, no background images here)
  return (
    <main id="main" tabIndex={-1} style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
      {/* Top-right cluster: Send feedback above Sign out */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 8,
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/upload" style={{ textDecoration: "none", fontWeight: 600 }}>
            Go to Uploads
          </Link>
          <Link href="/questionnaire" style={{ textDecoration: "none", fontWeight: 600 }}>
            Go to My Story
          </Link>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <a
            href={`mailto:girlsaidwhat@gmail.com?subject=${encodeURIComponent("Profile Page Issue")}&body=${encodeURIComponent(
              `Page: ${typeof window !== "undefined" ? window.location.href : "Profile"}\n\nWhat happened:\n`
            )}`}
            style={{ fontSize: 12, textDecoration: "underline", color: "#334155" }}
            aria-label="Send feedback about this page"
          >
            Send feedback
          </a>
          <button
            onClick={handleSignOut}
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

      {/* Header */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 6,
        }}
      >
        <h1 style={{ fontSize: 28, margin: 0 }}>
          {firstName ? `Welcome to Your Profile, ${firstName}` : "Welcome to Your Profile"}
        </h1>
      </header>

      {/* Divider */}
      <div
        role="separator"
        aria-hidden="true"
        style={{ height: 1, background: "#e5e7eb", margin: "6px 0 12px" }}
      />

      {/* TEMP banner */}
      <section
        id="temp-shell"
        style={{
          border: "2px dashed #9ca3af",
          borderRadius: 10,
          padding: 16,
          background: "#f8fafc",
          color: "#111827",
        }}
        aria-label="Temporary shell"
        title="This page is intentionally minimal and image-free"
      >
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>
          TEMP PROFILE SHELL — NO IMAGE
        </div>
        <div style={{ fontSize: 13, opacity: 0.9 }}>
          If you still see an image on this page after a production deploy + hard refresh, it’s not coming from
          <code> pages/index.js</code>.
        </div>
      </section>

      {/* Footer nav to keep site usable */}
      <nav aria-label="Footer" style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link href="/gallery" style={{ textDecoration: "none" }}>Public Gallery</Link>
        <Link href="/browse" style={{ textDecoration: "none" }}>Browse</Link>
        <Link href="/resources" style={{ textDecoration: "none" }}>Resources</Link>
      </nav>

      {/* Extra safety within this page only */}
      <style jsx>{`
        #temp-shell,
        #main {
          background-image: none !important;
        }
      `}</style>
    </main>
  );
}
