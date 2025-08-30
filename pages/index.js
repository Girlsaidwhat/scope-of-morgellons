// pages/index.js
// Home: Welcome, first name + Profile + Gallery + CSV + Copy/Open + Load more
// Uses Supabase v2. No guest sign-in UI here (that stays in _app.js).

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
const INDEX_BUILD = "idx-36.156";

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

// ---------------- URL helpers (non-blocking thumbnails) ----------------
function normalizePath(p) {
  if (!p) return "";
  let s = String(p).trim();
  if (s.startsWith("/")) s = s.slice(1);
  return s;
}

async function batchSignedUrls(bucket, paths) {
  try {
    if (paths.length === 0) return [];
    const { data, error } = await supabase.storage.from(bucket).createSignedUrls(paths, 60 * 60);
    if (error || !Array.isArray(data)) return [];
    return data.map((x) => x?.signedUrl || "");
  } catch {
    return [];
  }
}

async function singleSignedUrl(bucket, path) {
  try {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
    if (error) return "";
    return data?.signedUrl || "";
  } catch {
    return "";
  }
}

function publicUrl(bucket, path) {
  try {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data?.publicUrl || "";
  } catch {
    return "";
  }
}

// Last-resort download with small concurrency; updates items as each finishes.
async function downloadToBlobUrl(bucket, path) {
  try {
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (!error && data) {
      return URL.createObjectURL(data);
    }
  } catch {}
  return "";
}

// Update display_url for item at absolute index
function setItemUrl(setItems, absIndex, url) {
  if (!url) return;
  setItems((prev) => {
    if (!prev[absIndex]) return prev;
    const next = [...prev];
    next[absIndex] = { ...next[absIndex], display_url: url };
    return next;
  });
}

async function resolveUrlsInBackground(setItems, startIndex, batchRows, bucketGuess, userId) {
  const bucket = bucketGuess || "images";

  // Paths to try for each row
  const primaryPaths = batchRows.map((r) => normalizePath(r.storage_path || ""));
  const altPaths = batchRows.map((r) =>
    r.filename ? `${r.user_id || userId || ""}/${r.filename}`.replace(/^\/+/, "") : ""
  );

  // 1) Try batch signed URLs for primary paths
  const signedPrimary = await batchSignedUrls(bucket, primaryPaths);

  // Apply successes
  signedPrimary.forEach((u, i) => {
    if (u) setItemUrl(setItems, startIndex + i, u);
  });

  // 2) For any still blank, try alt path signed URLs individually, then public URL
  for (let i = 0; i < batchRows.length; i++) {
    const abs = startIndex + i;
    const had = signedPrimary[i];
    if (had) continue;

    const alt = normalizePath(altPaths[i]);
    if (alt) {
      const su = await singleSignedUrl(bucket, alt);
      if (su) {
        setItemUrl(setItems, abs, su);
        continue;
      }
      const pu = publicUrl(bucket, alt);
      if (pu) {
        setItemUrl(setItems, abs, pu);
        continue;
      }
    }

    // Try public URL on primary as well (cheap)
    const primary = normalizePath(primaryPaths[i]);
    if (primary) {
      const pu2 = publicUrl(bucket, primary);
      if (pu2) {
        setItemUrl(setItems, abs, pu2);
      }
    }
  }

  // 3) For any items still without a URL, attempt light download with concurrency=3
  const unresolved = [];
  for (let i = 0; i < batchRows.length; i++) {
    const abs = startIndex + i;
    unresolved.push({ abs, primary: normalizePath(primaryPaths[i]), alt: normalizePath(altPaths[i]) });
  }

  let ptr = 0;
  const workers = new Array(3).fill(0).map(async () => {
    while (ptr < unresolved.length) {
      const cur = unresolved[ptr++];
      // Skip if already filled
      let already = false;
      setItems((prev) => {
        const has = !!prev[cur.abs]?.display_url;
        already = has;
        return prev;
      });
      if (already) continue;

      const p1 = cur.primary ? await downloadToBlobUrl(bucket, cur.primary) : "";
      if (p1) {
        setItemUrl(setItems, cur.abs, p1);
        continue;
      }
      const p2 = cur.alt ? await downloadToBlobUrl(bucket, cur.alt) : "";
      if (p2) {
        setItemUrl(setItems, cur.abs, p2);
        continue;
      }
      // If all failed, leave empty; card still works (opens detail page)
    }
  });
  await Promise.all(workers);
}

function nonEmpty(v) {
  return typeof v === "string" && v.trim().length > 0;
}

// Tolerant bulk update: push profile fields to all of the user's images.
// Tries one multi-column update; if the table lacks some columns, falls back to per-column updates and ignores "column does not exist" errors.
async function updateImageMetadataForUserProfile(userId, fields) {
  if (!userId) return;
  try {
    const { error } = await supabase
      .from("image_metadata")
      .update(fields)
      .eq("user_id", userId);
    if (error) throw error;
  } catch (err) {
    const entries = Object.entries(fields);
    for (const [col, val] of entries) {
      try {
        const { error } = await supabase
          .from("image_metadata")
          .update({ [col]: val })
          .eq("user_id", userId);
        if (error) {
          const raw = error.message || "";
          const msg = raw.toLowerCase();
          const ignorable =
            msg.includes("does not exist") ||
            msg.includes("could not find") ||
            msg.includes("schema cache") ||
            (msg.includes("unknown") && msg.includes("column")) ||
            (msg.includes("column") && msg.includes("not found"));
          if (!ignorable) throw error;
        }
      } catch {}
    }
  }
}

// ------------------------------------------------------------------------

export default function HomePage() {
  const router = useRouter();

  // Auth/user
  const [user, setUser] = useState(null);

  // Profile form (schema-tolerant)
  const [initials, setInitials] = useState("");
  const [firstNameField, setFirstNameField] = useState("");
  const [lastNameField, setLastNameField] = useState("");
  const [age, setAge] = useState("");
  const [location, setLocation] = useState("");
  const [contactPref, setContactPref] = useState("researchers_and_members");
  const [profileStatus, setProfileStatus] = useState("");

  // Gallery
  const [count, setCount] = useState(null);
  const [items, setItems] = useState([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [galleryStatus, setGalleryStatus] = useState("");

  // Per-card "copied!" feedback
  const [copiedMap, setCopiedMap] = useState({}); // { [id]: true }

  // One-shot retry guard for image onError (prevents loops)
  const retrySetRef = useRef(new Set());

  // Cleanup blob: URLs on unmount
  useEffect(() => {
    return () => {
      try {
        items.forEach((row) => {
          if (row?.display_url && String(row.display_url).startsWith("blob:")) {
            URL.revokeObjectURL(row.display_url);
          }
        });
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Derive first name for greeting
  const firstName = useMemo(() => {
    const m = user?.user_metadata?.first_name?.trim();
    if (m) return m;
    const email = user?.email || "";
    const local = email.split("@")[0] || "";
    const piece = (local.split(/[._-]/)[0] || local).trim();
    return piece ? piece[0].toUpperCase() + piece.slice(1) : "";
  }, [user]);

  // Reset gallery when user changes
  useEffect(() => {
    setItems([]);
    setOffset(0);
    setCount(null);
    setGalleryStatus("");
    setCopiedMap({});
    retrySetRef.current = new Set(); // reset retry guard on user change
  }, [user?.id]);

  // Fetch total count
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
        setCount(null);
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
      .select("id, user_id, storage_path, filename, category, bleb_color, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      setGalleryStatus(`Load error: ${error.message}`);
      setLoading(false);
      return;
    }

    const batch = (data || []).map((r) => ({ ...r, display_url: "" }));
    const startIndex = items.length;

    // 1) Show the grid immediately with placeholders
    setItems((prev) => [...prev, ...batch]);
    setOffset((prev) => prev + batch.length);
    setGalleryStatus("");
    setLoading(false);

    // 2) Resolve URLs in the background
    resolveUrlsInBackground(setItems, startIndex, batch, "images", user.id);
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
    return items.length % PAGE_SIZE === 0;
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

  // ---------- Profile: load (schema-tolerant) ----------
  useEffect(() => {
    if (!user?.id) return;
    let canceled = false;
    (async () => {
      const { data, error } = await supabase
        .from("user_profile")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (canceled) return;

      if (error && error.code === "PGRST116") {
        // No row yet; fall back to auth metadata for names
        if (nonEmpty(user?.user_metadata?.first_name)) {
          setFirstNameField(user.user_metadata.first_name);
        }
        if (nonEmpty(user?.user_metadata?.last_name)) {
          setLastNameField(user.user_metadata.last_name);
        }
        setProfileStatus("");
        return;
      }
      if (error) {
        setProfileStatus(`Profile load error: ${error.message}`);
        return;
      }
      const d = data || {};

      setInitials(d.uploader_initials ?? d.initials ?? "");

      // Names: prefer DB values, otherwise fall back to auth metadata
      const dbFirst = d.first_name ?? d.uploader_first_name ?? "";
      const dbLast = d.last_name ?? d.uploader_last_name ?? "";
      setFirstNameField(nonEmpty(dbFirst) ? dbFirst : (user?.user_metadata?.first_name || ""));
      setLastNameField(nonEmpty(dbLast) ? dbLast : (user?.user_metadata?.last_name || ""));

      const ageSrc =
        d.uploader_age ?? d.age ?? d.uploaderAge ?? d.user_age ?? null;
      setAge(ageSrc === null || typeof ageSrc === "undefined" ? "" : String(ageSrc));

      setLocation(d.uploader_location ?? d.location ?? "");

      if (typeof d.contact_preference === "string") {
        const v = d.contact_preference;
        if (
          v === "researchers_and_members" ||
          v === "researchers_only" ||
          v === "members_only"
        ) {
          setContactPref(v);
        }
      } else {
        const opt =
          d.uploader_contact_opt_in ?? d.contact_opt_in ?? d.opt_in ?? null;
        if (opt === false) setContactPref("members_only");
        if (opt === true) setContactPref("researchers_and_members");
      }
      setProfileStatus("");
    })();
    return () => {
      canceled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ---------- Profile: save (save to auth.user_metadata + DB columns; then push to images) ----------
  async function saveProfile(e) {
    e.preventDefault();
    if (!user?.id) return;
    setProfileStatus("Saving...");

    try {
      // 0) Ensure row exists
      await supabase
        .from("user_profile")
        .upsert({ user_id: user.id }, { onConflict: "user_id" });

      // 1) Update auth metadata (reliable persistence across sessions)
      const metaPayload = {
        first_name: nonEmpty(firstNameField) ? firstNameField : null,
        last_name: nonEmpty(lastNameField) ? lastNameField : null,
      };
      const { error: metaErr } = await supabase.auth.updateUser({ data: metaPayload });
      if (metaErr) {
        // Non-fatal: continue to DB updates
        console.warn("auth.updateUser error:", metaErr?.message);
      }

      // 2) DB updates (best-effort, tolerant to missing columns)
      const ageVal =
        age === "" || age === null || typeof age === "undefined"
          ? null
          : Number(age);

      const researchersAllowed =
        contactPref === "researchers_and_members" ||
        contactPref === "researchers_only";

      const updates = [
        ["uploader_initials", initials || null],
        ["initials", initials || null],

        // Names to both styles (if columns exist)
        ["first_name", nonEmpty(firstNameField) ? firstNameField : null],
        ["uploader_first_name", nonEmpty(firstNameField) ? firstNameField : null],
        ["last_name", nonEmpty(lastNameField) ? lastNameField : null],
        ["uploader_last_name", nonEmpty(lastNameField) ? lastNameField : null],

        ["uploader_age", ageVal],
        ["age", ageVal],
        ["uploader_location", location || null],
        ["location", location || null],
        ["contact_preference", contactPref],
        ["uploader_contact_opt_in", researchersAllowed],
        ["contact_opt_in", researchersAllowed],
      ];

      for (const [col, val] of updates) {
        const { error } = await supabase
          .from("user_profile")
          .update({ [col]: val })
          .eq("user_id", user.id);

        if (error) {
          const raw = error.message || "";
          const msg = raw.toLowerCase();
          const ignorable =
            msg.includes("does not exist") ||
            msg.includes("could not find") ||
            msg.includes("schema cache") ||
            (msg.includes("unknown") && msg.includes("column")) ||
            (msg.includes("column") && msg.includes("not found"));
          if (ignorable) continue;
          throw error;
        }
      }

      // 3) Push updated profile fields to all existing images for this user (RLS-safe)
      await updateImageMetadataForUserProfile(user.id, {
        uploader_initials: initials || null,
        uploader_first_name: nonEmpty(firstNameField) ? firstNameField : null,
        uploader_last_name: nonEmpty(lastNameField) ? lastNameField : null,
        uploader_age: ageVal,
        uploader_location: location || null,
        uploader_contact_opt_in: researchersAllowed,
      });

      setProfileStatus("Profile saved.");
      setTimeout(() => setProfileStatus(""), 1500);
    } catch (err) {
      setProfileStatus(`Save error: ${err?.message || "Unknown error"}`);
    }
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
    try {
      await supabase.auth.signOut();
    } finally {
      router.push("/");
    }
  }

  // One-shot image error handler: re-signs a fresh URL, then updates that card
  async function handleImgError(rowId, absIndex, storagePath, filename, rowUserId) {
    try {
      if (!rowId && rowId !== 0) return;
      const tried = retrySetRef.current;
      if (tried.has(rowId)) return; // guard: only try once
      tried.add(rowId);

      const bucket = "images";
      const primary = normalizePath(storagePath || "");
      const alt = filename ? normalizePath(`${rowUserId || user?.id || ""}/${filename}`) : "";

      let newUrl = "";

      // Try re-signing primary then alt
      if (!newUrl && primary) newUrl = await singleSignedUrl(bucket, primary);
      if (!newUrl && alt)     newUrl = await singleSignedUrl(bucket, alt);

      // Fall back to public URLs
      if (!newUrl && alt)     newUrl = publicUrl(bucket, alt);
      if (!newUrl && primary) newUrl = publicUrl(bucket, primary);

      // Last resort: blob downloads
      if (!newUrl && primary) newUrl = await downloadToBlobUrl(bucket, primary);
      if (!newUrl && alt)     newUrl = await downloadToBlobUrl(bucket, alt);

      if (newUrl) setItemUrl(setItems, absIndex, newUrl);
    } catch {
      // swallow; placeholder remains
    }
  }

  // If session not ready or not signed in, render nothing here.
  if (!user) return null;

  return (
    <main
      id="main"
      data-index-build={INDEX_BUILD}
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

        {/* Initials (small box) */}
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
              width: 90,
              padding: 8,
              border: "1px solid #ccc",
              borderRadius: 6,
            }}
          />
        </div>

        {/* First name */}
        <div>
          <label
            htmlFor="first_name"
            style={{ fontSize: 12, display: "block", marginBottom: 4 }}
          >
            First name
          </label>
          <input
            id="first_name"
            value={firstNameField}
            onChange={(e) => setFirstNameField(e.target.value)}
            style={{
              width: "100%",
              padding: 8,
              border: "1px solid #ccc",
              borderRadius: 6,
            }}
          />
        </div>

        {/* Last name */}
        <div>
          <label
            htmlFor="last_name"
            style={{ fontSize: 12, display: "block", marginBottom: 4 }}
          >
            Last name
          </label>
          <input
            id="last_name"
            value={lastNameField}
            onChange={(e) => setLastNameField(e.target.value)}
            style={{
              width: "100%",
              padding: 8,
              border: "1px solid #ccc",
              borderRadius: 6,
            }}
          />
        </div>

        {/* Age */}
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

        {/* Location */}
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

        {/* Contact opt-in (3 options) */}
        <fieldset
          aria-label="Contact opt-in"
          style={{
            border: "1px solid #e5e5e5",
            borderRadius: 8,
            padding: 10,
          }}
        >
          <legend style={{ fontSize: 12, padding: "0 6px" }}>
            Contact opt-in
          </legend>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 12, display: "flex", gap: 8 }}>
              <input
                type="radio"
                name="contact_preference"
                value="researchers_and_members"
                checked={contactPref === "researchers_and_members"}
                onChange={(e) => setContactPref(e.target.value)}
              />
              <span>Researchers & members</span>
            </label>
            <label style={{ fontSize: 12, display: "flex", gap: 8 }}>
              <input
                type="radio"
                name="contact_preference"
                value="researchers_only"
                checked={contactPref === "researchers_only"}
                onChange={(e) => setContactPref(e.target.value)}
              />
              <span>Researchers only</span>
            </label>
            <label style={{ fontSize: 12, display: "flex", gap: 8 }}>
              <input
                type="radio"
                name="contact_preference"
                value="members_only"
                checked={contactPref === "members_only"}
                onChange={(e) => setContactPref(e.target.value)}
              />
              <span>Members only</span>
            </label>
          </div>
        </fieldset>

        {/* Save */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="submit"
            aria-label="Save profile"
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #0f766e",
              background: "#14b8a6",
              color: "white",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: 12,
              whiteSpace: "nowrap",
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

      {/* Small CSV button right above the gallery, with hover explanation */}
      <div style={{ margin: "4px 0 10px" }}>
        <button
          onClick={exportCSV}
          aria-label="Export all image metadata to CSV"
          title="Download a CSV of your gallery’s details (filenames, categories, notes, and more)."
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #1e293b",
            background: "#1f2937",
            color: "white",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 12,
            whiteSpace: "nowrap",
          }}
        >
          Export CSV
        </button>
      </div>

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
          {items.map((row, i) => {
            const url = row.display_url || "";
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
                {url ? (
                  <img
                    src={url}
                    alt={row.filename || row.storage_path || "image"}
                    style={{
                      width: "100%",
                      height: 160,
                      objectFit: "cover",
                      display: "block",
                    }}
                    onError={() =>
                      handleImgError(
                        row.id,
                        i,
                        row.storage_path,
                        row.filename,
                        row.user_id
                      )
                    }
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: 160,
                      background: "#f1f5f9",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#64748b",
                      fontSize: 12,
                    }}
                  >
                    Preview loading…
                  </div>
                )}
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
                    {row.category === "Blebs (clear to brown)" && row.bleb_color ? (
                      <Badge>Color: {row.bleb_color}</Badge>
                    ) : null}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    {prettyDate(row.created_at)}
                  </div>

                  {/* Card actions */}
                  {url ? (
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button
                        onClick={(e) => handleCopy(e, url, row.id)}
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
                        onClick={(e) => handleOpen(e, url)}
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
