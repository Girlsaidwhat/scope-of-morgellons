// pages/index.js
// Restored Home: Welcome, first name + Profile + Gallery + CSV + Copy/Open + Load more
// Uses Supabase v2. No guest sign-in UI here (that stays in _app.js).

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const PAGE_SIZE = 24;

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

export default function HomePage() {
  const router = useRouter();

  // Auth/user
  const [user, setUser] = useState(null);

  // Profile form (mapped to current schema uploader_* to match RLS policies)
  const [initials, setInitials] = useState("");
  const [age, setAge] = useState("");
  const [location, setLocation] = useState("");
  const [contactOptIn, setContactOptIn] = useState(false);
  const [profileStatus, setProfileStatus] = useState("");

  // Gallery
  const [count, setCount] = useState(null);
  const [items, setItems] = useState([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [galleryStatus, setGalleryStatus] = useState("");

  // Per-card "copied!" feedback
  const [copiedMap, setCopiedMap] = useState({}); // { [id]: true }

  // Load user (session)
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setUser(data?.session?.user ?? null);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setUser(sess?.user ?? null);
    });
    return () => {
      sub.subscription?.unsubscribe?.();
      mounted = false;
    };
  }, []);

  // Derive first name (prefer user_metadata.first_name; fallback from email)
  const firstName = useMemo(() => {
    const m = user?.user_metadata?.first_name?.trim();
    if (m) return m;
    const email = user?.email || "";
    const local = email.split("@")[0] || "";
    const piece = (local.split(/[._-]/)[0] || local).trim();
    return piece ? piece[0].toUpperCase() + piece.slice(1) : "";
  }, [user]);

  // Reset gallery when user changes (or after sign-in)
  useEffect(() => {
    setItems([]);
    setOffset(0);
    setCount(null);
    setGalleryStatus("");
    setCopiedMap({});
  }, [user?.id]);

  // Fetch total count (header)
  useEffect(() => {
    if (!user?.id) return;
    let canceled = false;
    (async () => {
      const { count: total, error } = await supabase
        .from("image_metadata")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      if (canceled) return;
      if (error) {
        setCount(null); // unknown; do not block UI
        return;
      }
      setCount(typeof total === "number" ? total : null);
    })();
    return () => {
      canceled = true;
    };
  }, [user?.id]);

  // Load a page of gallery items (append)
  async function loadMore() {
    if (!user?.id) return;
    setLoading(true);
    if (items.length === 0) setGalleryStatus("Loading...");

    const { data, error } = await supabase
      .from("image_metadata")
      .select("id, storage_path, filename, category, bleb_color, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      setGalleryStatus(`Load error: ${error.message}`);
      setLoading(false);
      return;
    }

    const batch = data || [];
    setItems((prev) => [...prev, ...batch]);
    setOffset((prev) => prev + batch.length);
    setGalleryStatus("");
    setLoading(false);
  }

  // Initial gallery load
  useEffect(() => {
    if (user?.id && offset === 0 && items.length === 0) {
      loadMore();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Determine if more pages likely exist
  const hasMore = useMemo(() => {
    if (loading) return false;
    if (items.length === 0) return false;
    if (typeof count === "number") return items.length < count;
    return items.length % PAGE_SIZE === 0; // unknown count: offer more if the last page was full
  }, [items.length, count, loading]);

  // CSV export (all rows for signed-in user)
  async function exportCSV() {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from("image_metadata")
      .select(
        "id, filename, category, bleb_color, uploader_initials, uploader_age, uploader_location, uploader_contact_opt_in, notes, created_at, storage_path"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      alert(`CSV error: ${error.message}`);
      return;
    }

    const rows = data || [];
    if (rows.length === 0) {
      alert("No rows to export.");
      return;
    }

    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","),
      ...rows.map((r) =>
        headers
          .map((h) => {
            const v = r[h];
            if (v === null || v === undefined) return "";
            const s = String(v).replace(/"/g, '""');
            return /[",\n]/.test(s) ? `"${s}"` : s;
          })
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "image_metadata.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // Profile load (current schema fields)
  useEffect(() => {
    if (!user?.id) return;
    let canceled = false;
    (async () => {
      const { data, error } = await supabase
        .from("user_profile")
        .select(
          "uploader_initials, uploader_age, uploader_location, uploader_contact_opt_in"
        )
        .single();
      if (canceled) return;
      if (error && error.code !== "PGRST116") {
        setProfileStatus(`Profile load error: ${error.message}`);
        return;
      }
      if (data) {
        setInitials(data.uploader_initials || "");
        setAge(
          data.uploader_age === null || data.uploader_age === undefined
            ? ""
            : String(data.uploader_age)
        );
        setLocation(data.uploader_location || "");
        setContactOptIn(!!data.uploader_contact_opt_in);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [user?.id]);

  // Save profile (current schema fields)
  async function saveProfile(e) {
    e.preventDefault();
    if (!user?.id) return;
    setProfileStatus("Saving...");
    const payload = {
      uploader_initials: initials || null,
      uploader_age: age === "" ? null : Number(age),
      uploader_location: location || null,
      uploader_contact_opt_in: contactOptIn,
    };
    const { error } = await supabase
      .from("user_profile")
      .upsert(payload, { onConflict: "user_id" });
    if (error) {
      setProfileStatus(`Save error: ${error.message}`);
      return;
    }
    setProfileStatus("Profile saved.");
    setTimeout(() => setProfileStatus(""), 1500);
  }

  // Card helpers
  function cardColorBadge(row) {
    if (row.category === "Blebs (clear to brown)" && row.bleb_color)
      return <Badge>Color: {row.bleb_color}</Badge>;
    return null;
  }

  async function handleCopy(e, url, id) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
      setCopiedMap((m) => ({ ...m, [id]: true }));
      setTimeout(() => {
        setCopiedMap((m) => {
          const n = { ...m };
          delete n[id];
          return n;
        });
      }, 1000);
    } catch {
      alert("Copy failed.");
    }
  }

  function handleOpen(e, url) {
    e.preventDefault();
    e.stopPropagation();
    try {
      window.open(url, "_blank", "noopener");
    } catch {}
  }

  async function handleSignOut() {
    // Sign out and route to "/"
    try {
      await supabase.auth.signOut();
    } finally {
      router.push("/");
    }
  }

  // If session not ready or not signed in, render nothing here.
  // _app.js controls the sign-in screen on "/".
  if (!user) return null;

  return (
    <main
      id="main"
      tabIndex={-1}
      style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}
    >
      {/* Header */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 16,
        }}
      >
        <h1 style={{ fontSize: 24, margin: 0 }}>
          {firstName ? `Welcome, ${firstName}` : "Welcome"}
        </h1>
        <div style={{ fontSize: 14, opacity: 0.8 }}>
          Total items: <strong>{typeof count === "number" ? count : "…"}</strong>
        </div>
      </header>

      {/* Actions row (left: Uploads, right: Sign out) */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <Link href="/upload" style={{ textDecoration: "none", fontWeight: 600 }}>
          Go to Uploads
        </Link>

        {/* Right-side grouped actions */}
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            justifyContent: "flex-end",
            maxWidth: "100%",
          }}
        >
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

      {/* Profile form */}
      <form
        onSubmit={saveProfile}
        aria-labelledby="profile-form-heading"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
          padding: 12,
          border: "1px solid #e5e5e5",
          borderRadius: 10,
          background: "#fff",
          marginBottom: 16,
        }}
      >
        <h2
          id="profile-form-heading"
          style={{
            position: "absolute",
            left: -9999,
            top: "auto",
            width: 1,
            height: 1,
            overflow: "hidden",
          }}
        >
          Profile
        </h2>
        <div>
          <label
            htmlFor="initials"
            style={{ fontSize: 12, display: "block", marginBottom: 4 }}
          >
            Initials
          </label>
          <input
            id="initials"
            value={initials}
            onChange={(e) => setInitials(e.target.value)}
            style={{
              width: "100%",
              padding: 8,
              border: "1px solid #ccc",
              borderRadius: 6,
            }}
          />
        </div>
        <div>
          <label
            htmlFor="age"
            style={{ fontSize: 12, display: "block", marginBottom: 4 }}
          >
            Age
          </label>
          <input
            id="age"
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            style={{
              width: "100%",
              padding: 8,
              border: "1px solid #ccc",
              borderRadius: 6,
            }}
          />
        </div>
        <div>
          <label
            htmlFor="location"
            style={{ fontSize: 12, display: "block", marginBottom: 4 }}
          >
            Location
          </label>
          <input
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            style={{
              width: "100%",
              padding: 8,
              border: "1px solid #ccc",
              borderRadius: 6,
            }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            id="optin"
            type="checkbox"
            checked={contactOptIn}
            onChange={(e) => setContactOptIn(e.target.checked)}
          />
          <label htmlFor="optin" style={{ fontSize: 12 }}>
            Contact opt-in
          </label>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="submit"
            aria-label="Save profile"
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #0f766e",
              background: "#14b8a6",
              color: "white",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Save Profile
          </button>
          <span
            role="status"
            aria-live="polite"
            aria-atomic="true"
            style={{ fontSize: 12, opacity: 0.8 }}
          >
            {profileStatus}
          </span>
        </div>
      </form>

      {/* Gallery status (initial) */}
      {galleryStatus && items.length === 0 ? (
        <div
          style={{
            padding: 12,
            border: "1px solid #ddd",
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          {galleryStatus}
        </div>
      ) : null}

      {/* Small CSV button right above the gallery */}
      <div style={{ margin: "4px 0 10px" }}>
        <button
          onClick={exportCSV}
          aria-label="Export all image metadata to CSV"
          style={{
            padding: "6px 10px", // smaller than before
            borderRadius: 8,
            border: "1px solid #1e293b",
            background: "#1f2937",
            color: "white",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 12, // slightly smaller text
            whiteSpace: "nowrap",
          }}
          title="Export CSV"
        >
          Export CSV
        </button>
      </div>

      {/* Gallery grid */}
      {items.length > 0 ? (
        <div
          role="list"
          aria-label="Your images"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          {items.map((row) => {
            // Build a public URL from storage_path if present
            let publicUrl = "";
            if (row.storage_path) {
              const { data: pub } = supabase.storage
                .from("images")
                .getPublicUrl(row.storage_path);
              publicUrl = pub?.publicUrl || "";
            }
            const copied = !!copiedMap[row.id];
            return (
              <a
                role="listitem"
                key={row.id}
                href={`/image/${row.id}`}
                style={{
                  display: "block",
                  textDecoration: "none",
                  color: "inherit",
                  border: "1px solid #e5e5e5",
                  borderRadius: 8,
                  overflow: "hidden",
                  background: "#fff",
                }}
                aria-label={`Open details for ${row.filename || row.id}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {publicUrl ? (
                  <img
                    src={publicUrl}
                    alt={row.filename || row.storage_path || "image"}
                    style={{
                      width: "100%",
                      height: 160,
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                ) : null}
                <div style={{ padding: 10 }}>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      flexWrap: "wrap",
                      marginBottom: 6,
                    }}
                  >
                    {row.category ? <Badge>{row.category}</Badge> : null}
                    {cardColorBadge(row)}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    {prettyDate(row.created_at)}
                  </div>

                  {/* Card actions */}
                  {publicUrl ? (
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button
                        onClick={(e) => handleCopy(e, publicUrl, row.id)}
                        aria-label={`Copy public link for ${row.filename || row.id}`}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #cbd5e1",
                          background: "#f8fafc",
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                        title="Copy image link"
                      >
                        {copied ? "Link copied!" : "Copy image link"}
                      </button>
                      <button
                        onClick={(e) => handleOpen(e, publicUrl)}
                        aria-label={`Open ${row.filename || row.id} in a new tab`}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #cbd5e1",
                          background: "#f8fafc",
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                        title="Open image in new tab"
                      >
                        Open image
                      </button>
                    </div>
                  ) : null}
                </div>
              </a>
            );
          })}
        </div>
      ) : null}

      {/* Load more / end-of-list / empty */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
        {items.length === 0 && !galleryStatus ? (
          <div style={{ fontSize: 12, opacity: 0.7 }}>No items yet.</div>
        ) : hasMore ? (
          <button
            onClick={loadMore}
            disabled={loading}
            aria-label="Load more images"
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #0f766e",
              background: loading ? "#8dd3cd" : "#14b8a6",
              color: "white",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            {loading ? "Loading..." : "Load more"}
          </button>
        ) : items.length > 0 ? (
          <div style={{ fontSize: 12, opacity: 0.7 }}>No more items.</div>
        ) : null}
      </div>
    </main>
  );
}

