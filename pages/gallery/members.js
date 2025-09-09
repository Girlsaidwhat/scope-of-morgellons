// pages/gallery/members.js
// Members-only site-wide Gallery (black background). Auth-gated.
// Temporarily reads public_gallery like the public page; we’ll expand later.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const SUPPORT_EMAIL = "girlsaidwhat@gmail.com";
function enc(s) { return encodeURIComponent(s); }
function makeMailBits() {
  const page = typeof window !== "undefined" ? window.location.href : "/gallery/members";
  const subject = `Members Gallery Page Issue`;
  const body = `Page: ${page}\n\nWhat happened:\n`;
  return { subject, body };
}
function feedbackHref() {
  const { subject, body } = makeMailBits();
  return `mailto:${SUPPORT_EMAIL}?subject=${enc(subject)}&body=${enc(body)}`;
}

function getPublicUrl(path) {
  try {
    const { data } = supabase.storage.from("public-thumbs").getPublicUrl(path);
    return data?.publicUrl || "";
  } catch {
    return "";
  }
}

export default function MembersGalleryPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setUser(data?.session?.user ?? null);
      setChecking(false);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setUser(sess?.user ?? null);
    });
    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        setStatus("Loading…");
        const { data, error } = await supabase
          .from("public_gallery")
          .select("public_path, created_at")
          .order("created_at", { ascending: false })
          .limit(180);
        if (error) throw error;
        if (cancelled) return;
        const list = (data || []).map((r) => ({
          path: r.public_path,
          url: getPublicUrl(r.public_path),
          created_at: r.created_at,
          state: "",
          country: "",
        }));
        setRows(list);
        setStatus(list.length ? "" : "No images yet.");
      } catch (e) {
        if (!cancelled) setStatus("Could not load gallery.");
        console.error("Members gallery load error:", e);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
    } finally {
      router.push("/");
    }
  }

  if (checking) {
    return (
      <main id="main" tabIndex={-1} style={{ minHeight: "100vh", background: "#000" }} />
    );
  }

  if (!user) {
    return (
      <main id="main" tabIndex={-1} style={{ minHeight: "100vh", background: "#000", color: "#f4f4f5", padding: 24 }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <h1 style={{ fontSize: 28, margin: 0 }}>Members Gallery</h1>
          </header>
          <div role="separator" aria-hidden="true" style={{ height: 1, background: "#1f2937", margin: "6px 0 12px" }} />
          <p>Please <a href="/signin" style={{ color: "#93c5fd" }}>sign in</a> to view the members gallery.</p>
        </div>
      </main>
    );
  }

  return (
    <>
      <a href="#main" style={{ position: "absolute", left: -9999, top: "auto", width: 1, height: 1, overflow: "hidden" }}>
        Skip to content
      </a>

      <main
        id="main"
        tabIndex={-1}
        style={{
          minHeight: "100vh",
          background: "#000",
          color: "#f4f4f5",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
          {/* Top links + right cluster (match Profile ordering: feedback above sign out) */}
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
              <Link href="/" style={{ textDecoration: "none", fontWeight: 600, color: "#e5e7eb" }}>
                Back to Profile
              </Link>
              <Link href="/upload" style={{ textDecoration: "none", fontWeight: 600, color: "#e5e7eb" }}>
                Go to Uploads
              </Link>
              <Link href="/questionnaire" style={{ textDecoration: "none", fontWeight: 600, color: "#e5e7eb" }}>
                Go to My Story
              </Link>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
              <a
                href={feedbackHref()}
                style={{ fontSize: 12, textDecoration: "underline", color: "#cbd5e1" }}
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
                  border: "1px solid #334155",
                  background: "#111827",
                  color: "white",
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

          {/* Header (match Profile) */}
          <header
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 6,
            }}
          >
            <h1 style={{ fontSize: 28, margin: 0 }}>Members Gallery</h1>
          </header>

          <div
            role="separator"
            aria-hidden="true"
            style={{ height: 1, background: "#1f2937", margin: "6px 0 12px" }}
          />

          {/* Status */}
          {status ? (
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              style={{
                padding: 12,
                border: "1px solid #374151",
                borderRadius: 8,
                marginBottom: 12,
                background: "#0b0f19",
                color: "#e5e7eb",
              }}
            >
              {status}
            </div>
          ) : null}

          {/* Grid */}
          {rows.length > 0 ? (
            <div
              role="list"
              aria-label="Members gallery images"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 14,
              }}
            >
              {rows.map((r, i) => (
                <div
                  key={i}
                  role="listitem"
                  style={{
                    position: "relative",
                    borderRadius: 12,
                    border: "1px solid #27272a",
                    overflow: "hidden",
                    background: "#0b0b0b",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={r.url}
                    alt="Anonymized gallery image"
                    style={{
                      display: "block",
                      width: "100%",
                      height: 220,
                      objectFit: "cover",
                    }}
                  />
                  <div
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      left: 8,
                      bottom: 8,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "rgba(17,24,39,0.7)",
                      border: "1px solid rgba(148,163,184,0.35)",
                      color: "#e5e7eb",
                      fontSize: 12,
                      fontWeight: 600,
                      backdropFilter: "blur(4px)",
                    }}
                  >
                    {r.state && r.country ? `${r.state}, ${r.country}` : "—"}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </main>
    </>
  );
}
