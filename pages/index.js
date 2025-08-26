// Build 36.70_fix_2025-08-25
import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Categories that can show an optional color badge
const COLORIZED = new Set([
  "Blebs (clear to brown)",
  "Fiber Bundles",
  "Fibers",
]);

function formatCategory(label) {
  if (!label) return "";
  return label
    .split(" ")
    .map((w) => (w[0] ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export default function HomePage() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);

  // Sign-in / Sign-up UI (logged out on "/")
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState("sign_in"); // "sign_in" | "sign_up"
  const [authMsg, setAuthMsg] = useState("");
  const [authErr, setAuthErr] = useState("");
  const [showTips, setShowTips] = useState(false);

  // Profile (signed in)
  const [initials, setInitials] = useState("");
  const [age, setAge] = useState("");
  const [location, setLocation] = useState("");
  const [optIn, setOptIn] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");

  // Gallery
  const [totalCount, setTotalCount] = useState(null);
  const [items, setItems] = useState([]);
  const [loadingInit, setLoadingInit] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageSize = 12;

  // CSV export
  const [csvMsg, setCsvMsg] = useState("");

  // Session bootstrap (prevents flicker)
  useEffect(() => {
    let unsub = () => {};
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session || null);
      setChecking(false);
      const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
        setSession(s || null);
      });
      unsub = sub.subscription?.unsubscribe || (() => {});
    })();
    return () => unsub();
  }, []);

  // Header text
  const firstName = useMemo(
    () => session?.user?.user_metadata?.first_name || "",
    [session]
  );
  const headerText = session
    ? firstName
      ? `Welcome, ${firstName}`
      : `Welcome, ${session.user?.email || ""}`
    : "Home";

  // Load profile when signed in
  useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("user_profile")
        .select("uploader_initials, uploader_age, uploader_location, uploader_contact_opt_in")
        .single();
      if (cancelled) return;
      if (!error && data) {
        setInitials(data.uploader_initials || "");
        setAge(data.uploader_age ? String(data.uploader_age) : "");
        setLocation(data.uploader_location || "");
        setOptIn(Boolean(data.uploader_contact_opt_in));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  // Load initial gallery + count (RLS shows only own rows)
  useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;
    (async () => {
      setLoadingInit(true);
      const { count } = await supabase
        .from("image_metadata")
        .select("id", { count: "exact", head: true });
      if (!cancelled) setTotalCount(count ?? 0);

      const { data } = await supabase
        .from("image_metadata")
        .select("id, storage_path, category, bleb_color, notes, created_at")
        .order("created_at", { ascending: false })
        .range(0, pageSize - 1);
      if (!cancelled) setItems(data || []);
      setLoadingInit(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  async function onLoadMore() {
    setLoadingMore(true);
    const from = items.length;
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("image_metadata")
      .select("id, storage_path, category, bleb_color, notes, created_at")
      .order("created_at", { ascending: false })
      .range(from, to);
    if (!error && data?.length) setItems((prev) => prev.concat(data));
    setLoadingMore(false);
  }

  // --- Auth handlers (Supabase v2) ---
  async function handleSignIn(e) {
    e.preventDefault();
    setAuthErr("");
    setAuthMsg("Signing inâ€¦");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setAuthMsg("Signed in.");
      // Reload Home to show Welcome + gallery
      window.location.assign("/");
    } catch (err) {
      setAuthMsg("");
      setAuthErr(err?.message || "Could not sign in.");
    }
  }

  async function handleSignUp(e) {
    e.preventDefault();
    setAuthErr("");
    setAuthMsg("Creating accountâ€¦");
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      setAuthMsg("Account created. Check your inbox to confirm, then sign in.");
    } catch (err) {
      setAuthMsg("");
      setAuthErr(err?.message || "Could not sign up.");
    }
  }

  async function handleForgot(e) {
    e.preventDefault();
    setAuthErr("");
    setAuthMsg("Sending reset emailâ€¦");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset`,
      });
      if (error) throw error;
      setAuthMsg("Check your email for the reset link.");
    } catch (err) {
      setAuthMsg("");
      setAuthErr(err?.message || "Could not send reset email.");
    }
  }

  async function onSaveProfile(e) {
    e.preventDefault();
    setProfileMsg("Savingâ€¦");
    const payload = {
      uploader_initials: initials.trim(),
      uploader_age: age ? Number(age) : null,
      uploader_location: location.trim(),
      uploader_contact_opt_in: optIn,
    };
    const { error } = await supabase.from("user_profile").upsert(payload, { onConflict: "user_id" });
    setProfileMsg(error ? "Could not save profile." : "Profile saved.");
    setTimeout(() => setProfileMsg(""), 1200);
  }

  async function onExportCSV() {
    setCsvMsg("Building CSVâ€¦");
    const { data, error } = await supabase
      .from("image_metadata")
      .select(
        "id, filename, category, bleb_color, uploader_initials, uploader_age, uploader_location, uploader_contact_opt_in, notes, created_at"
      )
      .order("created_at", { ascending: false });
    if (error) {
      setCsvMsg("Could not export CSV.");
      return;
    }
    const rows = [
      [
        "id",
        "filename",
        "category",
        "bleb_color",
        "uploader_initials",
        "uploader_age",
        "uploader_location",
        "uploader_contact_opt_in",
        "notes",
        "created_at",
      ],
      ...(data || []).map((r) => [
        r.id,
        r.filename ?? "",
        r.category ?? "",
        r.bleb_color ?? "",
        r.uploader_initials ?? "",
        r.uploader_age ?? "",
        r.uploader_location ?? "",
        r.uploader_contact_opt_in ? "true" : "false",
        (r.notes ?? "").replace(/\r?\n/g, " "),
        r.created_at ?? "",
      ]),
    ];
    const csv = rows
      .map((arr) =>
        arr
          .map((v) => {
            const s = String(v ?? "");
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "image_metadata.csv";
    a.click();
    URL.revokeObjectURL(url);
    setCsvMsg("CSV downloaded.");
    setTimeout(() => setCsvMsg(""), 1200);
  }

  function SignInBlock() {
    return ();
  }

  function SignedInBlock() {
    return (
      <>
        {/* Quick links */}
        <nav style={{ display: "flex", gap: 12, margin: "8px 0 16px" }}>
          <Link href="/upload">Go to Uploader</Link>
          <Link href="/browse">Browse by Category</Link>
          <button onClick={onExportCSV} aria-label="Export CSV" style={{ padding: "6px 10px" }}>
            Export CSV
          </button>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.assign("/");
            }}
            aria-label="Sign out"
            style={{ padding: "6px 10px", marginLeft: "auto" }}
          >
            Sign out
          </button>
        </nav>
        {csvMsg ? <p aria-live="polite">{csvMsg}</p> : null}

        {/* Profile */}
        <section aria-label="Profile" style={{ borderTop: "1px solid #eee", paddingTop: 12 }}>
          <h2 style={{ marginTop: 0 }}>Profile</h2>
          <p>Save your profile. Each upload stores a snapshot of these fields.</p>
          <form onSubmit={onSaveProfile} style={{ display: "grid", gap: 10, maxWidth: 520 }}>
            <label>
              <span>Initials</span>
              <input
                type="text"
                value={initials}
                onChange={(e) => setInitials(e.target.value)}
                style={{ width: "100%", padding: 8 }}
              />
            </label>
            <label>
              <span>Age</span>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                style={{ width: "100%", padding: 8 }}
              />
            </label>
            <label>
              <span>Location</span>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                style={{ width: "100%", padding: 8 }}
              />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={optIn}
                onChange={(e) => setOptIn(e.target.checked)}
              />
              <span>Open to being contacted by researchers or other members</span>
            </label>
            <button type="submit" style={{ padding: "8px 12px", width: "fit-content" }}>
              Save Profile
            </button>
            {profileMsg ? <p aria-live="polite">{profileMsg}</p> : null}
          </form>
        </section>

        {/* Gallery */}
        <section aria-label="Your Gallery" style={{ marginTop: 18 }}>
          <h2 style={{ marginTop: 0 }}>Your Gallery</h2>
          {!loadingInit && items.length === 0 ? <p>No images yet.</p> : null}

          <ul
            aria-label="image list"
            style={{
              listStyle: "none",
              padding: 0,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: 12,
            }}
          >
            {items.map((it) => (
              <li key={it.id} style={{ border: "1px solid #eee", borderRadius: 8, padding: 8 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
                  <span
                    style={{
                      fontSize: 12,
                      padding: "2px 6px",
                      border: "1px solid #ccc",
                      borderRadius: 6,
                    }}
                    aria-label="category badge"
                  >
                    {formatCategory(it.category)}
                  </span>
                  {COLORIZED.has(it.category || "") && it.bleb_color ? (
                    <span
                      style={{
                        fontSize: 12,
                        padding: "2px 6px",
                        border: "1px solid #ccc",
                        borderRadius: 6,
                      }}
                      aria-label="color badge"
                    >
                      {it.bleb_color}
                    </span>
                  ) : null}
                </div>
                <Link href={`/image/${it.id}`}>Open</Link>
              </li>
            ))}
          </ul>

          {items.length < (totalCount ?? 0) ? (
            <div style={{ marginTop: 12 }}>
              <button
                onClick={onLoadMore}
                disabled={loadingMore}
                aria-label="Load more items"
                style={{ padding: "8px 12px" }}
              >
                {loadingMore ? "Loadingâ€¦" : "Load more"}
              </button>
            </div>
          ) : (
            <p style={{ opacity: 0.8, marginTop: 12 }}>No more items.</p>
          )}
        </section>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>The Scope of Morgellons</title>
      </Head>

      <div data-build-line style={{ fontSize: 12, opacity: 0.7, padding: "4px 8px" }}>
        The Scope of Morgellons
      </div>

      <main id="main" style={{ maxWidth: 980, margin: "20px auto", padding: "0 12px" }}>
        <header style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <h1 style={{ margin: "0 0 6px" }}>{headerText}</h1>
          <span aria-live="polite">
            Total items: {session ? (totalCount ?? "â€¦") : "â€¦"}
          </span>
        </header>

        {!session ? <SignInBlock /> : <SignedInBlock />}
      </main>
    </>
  );
}

