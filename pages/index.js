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
const INDEX_BUILD = "idx-36.191";

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

async function downloadToBlobUrl(bucket, path) {
  try {
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (!error && data) {
      return URL.createObjectURL(data);
    }
  } catch {}
  return "";
}

function setItemUrl(setItems, absIndex, url) {
  if (!url) return;
  setItems((prev) => {
    if (!prev[absIndex]) return prev;
    const next = [...prev];
    next[absIndex] = { ...prev[absIndex], display_url: url };
    return next;
  });
}

async function resolveUrlsInBackground(setItems, startIndex, batchRows, bucketGuess, userId) {
  const bucket = bucketGuess || "images";
  const primaryPaths = batchRows.map((r) => normalizePath(r.storage_path || ""));
  const altPaths = batchRows.map((r) =>
    r.filename ? `${r.user_id || userId || ""}/${r.filename}`.replace(/^\/+/, "") : ""
  );

  const signedPrimary = await batchSignedUrls(bucket, primaryPaths);
  signedPrimary.forEach((u, i) => {
    if (u) setItemUrl(setItems, startIndex + i, u);
  });

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

    const primary = normalizePath(primaryPaths[i]);
    if (primary) {
      const pu2 = publicUrl(bucket, primary);
      if (pu2) setItemUrl(setItems, abs, pu2);
    }
  }

  const unresolved = [];
  for (let i = 0; i < batchRows.length; i++) {
    const abs = startIndex + i;
    unresolved.push({ abs, primary: normalizePath(primaryPaths[i]), alt: normalizePath(altPaths[i]) });
  }

  let ptr = 0;
  const workers = new Array(3).fill(0).map(async () => {
    while (ptr < unresolved.length) {
      const cur = unresolved[ptr++];
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
    }
  });
  await Promise.all(workers);
}

function nonEmpty(v) {
  return typeof v === "string" && v.trim().length > 0;
}

// Tolerant bulk update: push profile fields to all of the user's images.
async function updateImageMetadataForUserProfile(userId, fields) {
  if (!userId) return;
  try {
    const { error } = await supabase.from("image_metadata").update(fields).eq("user_id", userId);
    if (error) throw error;
  } catch (err) {
    const entries = Object.entries(fields);
    for (const [col, val] of entries) {
      try {
        const { error } = await supabase.from("image_metadata").update({ [col]: val }).eq("user_id", userId);
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

// -------------- US state list (abbr) --------------
const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"
];

// -------- Composite location helpers (store in location columns) --------
function formatCompositeLocation(city, stateAbbr, country) {
  const parts = [city, stateAbbr, country].map((p) => (p || "").trim()).filter(Boolean);
  return parts.join(", ");
}

function parseCompositeLocation(s) {
  const t = (s || "").trim();
  if (!t) return { city: "", state: "", country: "" };
  const parts = t.split(",").map((p) => p.trim()).filter(Boolean);
  let city = "", state = "", country = "";
  if (parts.length === 1) {
    city = parts[0];
  } else if (parts.length === 2) {
    city = parts[0];
    const p2 = parts[1].toUpperCase();
    if (US_STATES.includes(p2)) state = p2; else country = parts[1];
  } else {
    city = parts[0];
    const maybeState = parts[1].toUpperCase();
    if (US_STATES.includes(maybeState)) {
      state = maybeState;
      country = parts.slice(2).join(", ");
    } else {
      country = parts.slice(1).join(", ");
    }
  }
  return { city, state, country };
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
    const t = setInterval(() => setIdx((i) => (i + 1) % categories.length), 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <main id="main" tabIndex={-1} style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <nav aria-label="Main" style={{ display: "flex", justifyContent: "flex-end", gap: 14, marginBottom: 12 }}>
        <a href="#about" style={{ textDecoration: "none" }} title="Learn about the project">About</a>
        <a href="#news" style={{ textDecoration: "none" }} title="Latest updates">News</a>
        <a href="#resources" style={{ textDecoration: "none" }} title="Helpful links">Resources</a>
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
          An anonymized visual catalog to help researchers and the curious understand patterns and categories.
        </p>
      </header>

      <section aria-label="Categories" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
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

      <section id="about" style={{ marginTop: 20, borderTop: "1px solid #e5e7eb", paddingTop: 12 }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>About</h2>
        <p style={{ marginTop: 8, opacity: 0.9 }}>
          This project invites contributions and analysis while protecting member privacy. Images shown here are anonymized placeholders.
        </p>
      </section>

      <section id="news" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>News</h2>
        <p style={{ marginTop: 8, opacity: 0.9 }}>Updates coming soon.</p>
      </section>

      <section id="resources" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>Resources</h2>
        <p style={{ marginTop: 8, opacity: 0.9 }}>Curated links and reading will appear here.</p>
      </section>
    </main>
  );
}

// ------------------------------------------------------------------------

export default function HomePage() {
  const router = useRouter();

  // Auth/user
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false); // prevent Landing flash for signed-in users

  // Profile form (schema-tolerant)
  const [initials, setInitials] = useState("");
  const [firstNameField, setFirstNameField] = useState("");
  const [lastNameField, setLastNameField] = useState("");
  const [age, setAge] = useState("");
  const [city, setCity] = useState("");
  const [stateAbbr, setStateAbbr] = useState("");
  const [country, setCountry] = useState("");

  // Role + Who-can-contact
  const [role, setRole] = useState(""); // "patient" | "doctor" | "researcher" | "journalist" | "other"
  const [contactWho, setContactWho] = useState("all"); // "members" | "doctors" | "researchers" | "journalists" | "all"
  // Legacy back-compat (kept internal; not shown)
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

  const retrySetRef = useRef(new Set());

  const [csvBusy, setCsvBusy] = useState(false);
  const csvGateRef = useRef(false);
  const csvStartRef = useRef(0);
  const MIN_BUSY_MS = 1000;

  const [toast, setToast] = useState("");
  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  }

  // Deleted toast via query param
  useEffect(() => {
    if (!router.isReady) return;
    const hasDeleted = !!router.query?.deleted;
    if (!hasDeleted) return;
    showToast("Deleted");
    const newQuery = { ...router.query };
    delete newQuery.deleted;
    router.replace({ pathname: router.pathname, query: newQuery }, undefined, { shallow: true });
  }, [router.isReady, router.query?.deleted, router.pathname]);

  // Load user (session) — gate rendering until checked
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
    retrySetRef.current = new Set();
  }, [user?.id]);

  // ---------- Profile: load ----------
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

      const dbFirst = d.first_name ?? d.uploader_first_name ?? "";
      const dbLast = d.last_name ?? d.uploader_last_name ?? "";
      setFirstNameField(nonEmpty(dbFirst) ? dbFirst : (user?.user_metadata?.first_name || ""));
      setLastNameField(nonEmpty(dbLast) ? dbLast : (user?.user_metadata?.last_name || ""));

      const ageSrc = d.uploader_age ?? d.age ?? d.uploaderAge ?? d.user_age ?? null;
      setAge(ageSrc === null || typeof ageSrc === "undefined" ? "" : String(ageSrc));

      // City/State/Country from dedicated columns if present, else parse composite location
      const locRaw = d.uploader_location ?? d.location ?? "";
      let cityVal = d.uploader_city ?? d.city ?? "";
      let stateVal = d.uploader_state ?? d.state ?? "";
      let countryVal = d.uploader_country ?? d.country ?? "";

      if (!nonEmpty(cityVal) && nonEmpty(locRaw)) {
        const parsed = parseCompositeLocation(locRaw);
        if (!nonEmpty(cityVal)) cityVal = parsed.city;
        if (!nonEmpty(stateVal)) stateVal = parsed.state;
        if (!nonEmpty(countryVal)) countryVal = parsed.country;
      }

      setCity(cityVal || "");
      setStateAbbr(typeof stateVal === "string" ? stateVal.toUpperCase() : "");
      setCountry(countryVal || "");

      // Role (schema tolerant)
      const roleGuess = d.role ?? d.user_role ?? d.uploader_role ?? "";
      setRole(typeof roleGuess === "string" ? roleGuess.toLowerCase() : "");

      // Contact-who (schema tolerant) or derive from legacy contact_preference
      const who =
        d.contact_who ??
        d.contactable_by ??
        (d.contact_preference === "members_only"
          ? "members"
          : d.contact_preference === "researchers_only"
          ? "researchers"
          : d.contact_preference === "researchers_and_members"
          ? "all"
          : "");
      setContactWho(who || "all");

      if (who === "members") setContactPref("members_only");
      else if (who === "researchers") setContactPref("researchers_only");
      else setContactPref("researchers_and_members");

      setProfileStatus("");
    })();
    return () => { canceled = true; };
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
    return () => { canceled = true; };
  }, [user?.id]);

  // -------- Profile inputs: one-line layout + initials auto-fill ----------
  const initialsTouchedRef = useRef(false);
  useEffect(() => {
    if (initialsTouchedRef.current) return;
    const a = (firstNameField || "").trim().charAt(0).toUpperCase();
    const b = (lastNameField || "").trim().charAt(0).toUpperCase();
    const ni = (a + b).slice(0, 3);
    if (ni) setInitials(ni);
  }, [firstNameField, lastNameField]);

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

    setItems((prev) => [...prev, ...batch]);
    setOffset((prev) => prev + batch.length);
    setGalleryStatus("");
    setLoading(false);

    resolveUrlsInBackground(setItems, startIndex, batch, "images", user.id);
  }

  // Initial gallery load
  useEffect(() => {
    if (user?.id && offset === 0 && items.length === 0) {
      loadMore();
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasMore = useMemo(() => {
    if (loading) return false;
    if (items.length === 0) return false;
    if (typeof count === "number") return items.length < count;
    return items.length % PAGE_SIZE === 0;
  }, [items.length, count, loading]);

  async function exportCSV() {
    if (!user?.id) return;
    if (csvGateRef.current || csvBusy) return;
    csvGateRef.current = true;
    setCsvBusy(true);
    csvStartRef.current = performance.now();

    try {
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
    } finally {
      const elapsed = performance.now() - csvStartRef.current;
      const remaining = Math.max(0, MIN_BUSY_MS - elapsed);
      setTimeout(() => {
        setCsvBusy(false);
        csvGateRef.current = false;
      }, remaining);
    }
  }

  function handleOpen(e, url) {
    e.preventDefault();
    e.stopPropagation();
    try {
      window.open(url, "_blank", "noopener");
    } catch {}
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

  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
    } finally {
      router.push("/");
    }
  }

  async function handleImgError(rowId, absIndex, storagePath, filename, rowUserId) {
    try {
      if (!rowId && rowId !== 0) return;
      const tried = retrySetRef.current;
      if (tried.has(rowId)) return;
      tried.add(rowId);

      const bucket = "images";
      const primary = normalizePath(storagePath || "");
      const alt = filename ? normalizePath(`${rowUserId || user?.id || ""}/${filename}`) : "";

      let newUrl = "";

      if (!newUrl && primary) newUrl = await singleSignedUrl(bucket, primary);
      if (!newUrl && alt)     newUrl = await singleSignedUrl(bucket, alt);
      if (!newUrl && alt)     newUrl = publicUrl(bucket, alt);
      if (!newUrl && primary) newUrl = publicUrl(bucket, primary);
      if (!newUrl && primary) newUrl = await downloadToBlobUrl(bucket, primary);
      if (!newUrl && alt)     newUrl = await downloadToBlobUrl(bucket, alt);

      if (newUrl) setItemUrl(setItems, absIndex, newUrl);
    } catch {}
  }

  // ----- Render gating to avoid Landing flash for signed-in users -----
  if (!authReady) {
    return (
      <main id="main" tabIndex={-1} aria-busy="true" style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }} />
    );
  }
  if (!user) {
    return <Landing />;
  }

  // ---------- Logged-in Home ----------
  const srOnly = {
    position: "absolute",
    left: -9999,
    top: "auto",
    width: 1,
    height: 1,
    overflow: "hidden",
  };

  // Helpers for the “chip” look
  function Chip({ active, children }) {
    return (
      <span
        style={{
          padding: "6px 10px",
          borderRadius: 999,
          border: active ? "1px solid #0f766e" : "1px solid #cbd5e1",
          background: active ? "#14b8a6" : "#f8fafc",
          color: active ? "white" : "inherit",
          fontWeight: 600,
          fontSize: 12,
          cursor: "pointer",
          userSelect: "none",
          whiteSpace: "nowrap",
        }}
      >
        {children}
      </span>
    );
  }

  function RadioChip({ name, value, checked, onChange, label }) {
    return (
      <label style={{ display: "inline-flex", alignItems: "center" }}>
        <input
          type="radio"
          name={name}
          value={value}
          checked={checked}
          onChange={(e) => onChange(e.target.value)}
          style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
          aria-label={label}
        />
        <Chip active={checked}>{label}</Chip>
      </label>
    );
  }

  // Map “who can contact” → legacy contact_preference for back-compat
  function legacyPrefFromWho(who) {
    if (who === "members") return "members_only";
    if (who === "researchers") return "researchers_only";
    return "researchers_and_members"; // "doctors", "journalists", and "all" map to widest legacy set
  }

  return (
    <main
      id="main"
      data-index-build={INDEX_BUILD}
      tabIndex={-1}
      style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}
    >
      {/* Tiny toast (top-center) */}
      {toast ? (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          style={{
            position: "fixed",
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#111827",
            color: "white",
            border: "1px solid #0f172a",
            padding: "6px 10px",
            borderRadius: 999,
            fontSize: 12,
            zIndex: 1000,
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          }}
        >
          {toast}
        </div>
      ) : null}

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

      {/* Actions row */}
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
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/upload" style={{ textDecoration: "none", fontWeight: 600 }}>
            Go to Uploads
          </Link>
          <Link href="/questionnaire" style={{ textDecoration: "none", fontWeight: 600 }}>
            Go to My Story
          </Link>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end", maxWidth: "100%" }}>
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
        onSubmit={async (e) => {
          e.preventDefault();
          if (!user?.id) return;
          setProfileStatus("Saving...");

          try {
            await supabase
              .from("user_profile")
              .upsert({ user_id: user.id }, { onConflict: "user_id" });

            const metaPayload = {
              first_name: nonEmpty(firstNameField) ? firstNameField : null,
              last_name: nonEmpty(lastNameField) ? lastNameField : null,
            };
            const { error: metaErr } = await supabase.auth.updateUser({ data: metaPayload });
            if (metaErr) console.warn("auth.updateUser error:", metaErr?.message);

            const ageVal =
              age === "" || age === null || typeof age === "undefined"
                ? null
                : Number(age);

            // Compose a safe single-string location to persist
            const compositeLoc = formatCompositeLocation(city, stateAbbr, country);

            // Map who-can-contact to legacy preference + researcher opt-in
            const legacyPref = legacyPrefFromWho(contactWho);
            setContactPref(legacyPref);
            const researchersAllowed = contactWho === "researchers" || contactWho === "all";

            const updates = [
              ["uploader_initials", initials || null],
              ["initials", initials || null],
              ["first_name", nonEmpty(firstNameField) ? firstNameField : null],
              ["uploader_first_name", nonEmpty(firstNameField) ? firstNameField : null],
              ["last_name", nonEmpty(lastNameField) ? lastNameField : null],
              ["uploader_last_name", nonEmpty(lastNameField) ? lastNameField : null],
              ["uploader_age", ageVal],
              ["age", ageVal],

              // Persist composite location (works even without new columns)
              ["uploader_location", nonEmpty(compositeLoc) ? compositeLoc : null],
              ["location", nonEmpty(compositeLoc) ? compositeLoc : null],

              // Best-effort writes to potential dedicated columns
              ["uploader_city", nonEmpty(city) ? city : null],
              ["city", nonEmpty(city) ? city : null],
              ["uploader_state", nonEmpty(stateAbbr) ? stateAbbr.toUpperCase() : null],
              ["state", nonEmpty(stateAbbr) ? stateAbbr.toUpperCase() : null],
              ["uploader_country", nonEmpty(country) ? country : null],
              ["country", nonEmpty(country) ? country : null],

              // Role (schema tolerant)
              ["role", role || null],
              ["user_role", role || null],
              ["uploader_role", role || null],
              ["is_patient", role === "patient" ? true : role ? false : null],
              ["is_doctor", role === "doctor" ? true : role ? false : null],
              ["is_researcher", role === "researcher" ? true : role ? false : null],
              ["is_journalist", role === "journalist" ? true : role ? false : null],

              // Contact-who (new) + legacy fields (back-compat)
              ["contact_who", contactWho],
              ["contactable_by", contactWho],
              ["contact_preference", legacyPref],
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
                if (!ignorable) throw error;
              }
            }

            await updateImageMetadataForUserProfile(user.id, {
              uploader_initials: initials || null,
              uploader_age: ageVal,
              uploader_location: nonEmpty(compositeLoc) ? compositeLoc : null,
              uploader_contact_opt_in: researchersAllowed,
            });

            setProfileStatus("Profile saved.");
            showToast("Saved");
            setTimeout(() => setProfileStatus(""), 1500);
          } catch (err) {
            setProfileStatus(`Save error: ${err?.message || "Unknown error"}`);
          }
        }}
        aria-labelledby="profile-form-heading"
        style={{
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

        {/* One-line inputs */}
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "flex-end",
            whiteSpace: "nowrap",
            overflowX: "auto",
            paddingBottom: 2,
          }}
          aria-label="Basic profile fields"
        >
          {/* First name */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <label htmlFor="first_name" style={srOnly}>First name</label>
            <input
              id="first_name"
              placeholder="First"
              value={firstNameField}
              onChange={(e) => setFirstNameField(e.target.value)}
              style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6, minWidth: 120 }}
            />
          </div>

          {/* Last name */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <label htmlFor="last_name" style={srOnly}>Last name</label>
            <input
              id="last_name"
              placeholder="Last"
              value={lastNameField}
              onChange={(e) => setLastNameField(e.target.value)}
              style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6, minWidth: 120 }}
            />
          </div>

          {/* Initials (8ch) */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <label htmlFor="initials" style={srOnly}>Initials</label>
            <input
              id="initials"
              placeholder="INI"
              value={initials}
              maxLength={3}
              onChange={(e) => {
                initialsTouchedRef.current = true;
                setInitials(e.target.value.toUpperCase());
              }}
              title="Your initials (auto-fills from First + Last)"
              style={{
                padding: 8,
                border: "1px solid #ccc",
                borderRadius: 6,
                width: "8ch",
                minWidth: "8ch",
                textTransform: "uppercase",
                textAlign: "center",
              }}
            />
          </div>

          {/* Age (8ch) */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <label htmlFor="age" style={srOnly}>Age</label>
            <input
              id="age"
              type="number"
              inputMode="numeric"
              placeholder="Age"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              title="Age"
              style={{
                padding: 8,
                border: "1px solid #ccc",
                borderRadius: 6,
                width: "8ch",
                minWidth: "8ch",
                textAlign: "center",
              }}
            />
          </div>

          {/* City */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <label htmlFor="city" style={srOnly}>Location (City)</label>
            <input
              id="city"
              placeholder="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6, minWidth: 90, maxWidth: 140 }}
            />
          </div>

          {/* State dropdown */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <label htmlFor="state" style={srOnly}>State</label>
            <select
              id="state"
              value={stateAbbr}
              onChange={(e) => setStateAbbr(e.target.value)}
              title="State (US)"
              style={{
                padding: 8,
                border: "1px solid #ccc",
                borderRadius: 6,
                minWidth: 80,
              }}
            >
              <option value="">State</option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Country */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <label htmlFor="country" style={srOnly}>Country</label>
            <input
              id="country"
              placeholder="Country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6, minWidth: 100 }}
            />
          </div>
        </div>

        {/* Role: I am a ... */}
        <fieldset
          aria-label="I am a"
          style={{ border: "1px solid #e5e5e5", borderRadius: 8, padding: 10, marginTop: 10 }}
        >
          <legend style={{ fontSize: 12, padding: "0 6px" }}>I am a…</legend>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <RadioChip name="user_role" value="patient" checked={role === "patient"} onChange={setRole} label="Someone who has Morgellons" />
            <RadioChip name="user_role" value="doctor" checked={role === "doctor"} onChange={setRole} label="Doctor" />
            <RadioChip name="user_role" value="researcher" checked={role === "researcher"} onChange={setRole} label="Researcher" />
            <RadioChip name="user_role" value="journalist" checked={role === "journalist"} onChange={setRole} label="Journalist" />
            <RadioChip name="user_role" value="other" checked={role === "other"} onChange={setRole} label="Other" />
          </div>
        </fieldset>

        {/* Who can contact me */}
        <fieldset
          aria-label="Who can contact me"
          style={{ border: "1px solid #e5e5e5", borderRadius: 8, padding: 10, marginTop: 10 }}
        >
          <legend style={{ fontSize: 12, padding: "0 6px" }}>Who can contact me</legend>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <RadioChip name="contact_who" value="members" checked={contactWho === "members"} onChange={setContactWho} label="Other members" />
            <RadioChip name="contact_who" value="doctors" checked={contactWho === "doctors"} onChange={setContactWho} label="Doctors" />
            <RadioChip name="contact_who" value="researchers" checked={contactWho === "researchers"} onChange={setContactWho} label="Researchers" />
            <RadioChip name="contact_who" value="journalists" checked={contactWho === "journalists"} onChange={setContactWho} label="Journalists" />
            <RadioChip name="contact_who" value="all" checked={contactWho === "all"} onChange={setContactWho} label="All" />
          </div>
        </fieldset>

        {/* Save */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
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
          <span role="status" aria-live="polite" aria-atomic="true" style={{ fontSize: 12, opacity: 0.8 }}>
            {profileStatus}
          </span>
        </div>
      </form>

      {/* Small CSV button */}
      <div style={{ margin: "4px 0 10px" }}>
        <button
          onClick={exportCSV}
          aria-label="Export all image metadata to CSV"
          aria-busy={csvBusy ? "true" : "false"}
          aria-disabled={csvBusy ? "true" : "false"}
          disabled={csvBusy}
          title="Download a CSV of your gallery’s details (filenames, categories, notes, and more)."
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #1e293b",
            background: csvBusy ? "#475569" : "#1f2937",
            color: "white",
            cursor: csvBusy ? "wait" : "pointer",
            fontWeight: 600,
            fontSize: 12,
            whiteSpace: "nowrap",
            minWidth: 110,
            opacity: csvBusy ? 0.9 : 1,
          }}
        >
          {csvBusy ? "Preparing…" : "Export CSV"}
        </button>
      </div>

      {/* Gallery status (initial) */}
      {galleryStatus && items.length === 0 ? (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, marginBottom: 12 }}
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
                    style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }}
                    onError={() => handleImgError(row.id, i, row.storage_path, row.filename, row.user_id)}
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
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                    {row.category ? <Badge>{row.category}</Badge> : null}
                    {row.category === "Blebs (clear to brown)" && row.bleb_color ? (
                      <Badge>Color: {row.bleb_color}</Badge>
                    ) : null}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>{prettyDate(row.created_at)}</div>

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
          <div role="status" aria-live="polite" aria-atomic="true" style={{ fontSize: 12, opacity: 0.7 }}>
            No items yet.
          </div>
        ) : hasMore ? (
          <button
            onClick={loadMore}
            disabled={loading}
            aria-label="Load more images"
            aria-busy={loading ? "true" : "false"}
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
          <div role="status" aria-live="polite" aria-atomic="true" style={{ fontSize: 12, opacity: 0.7 }}>
            No more items.
          </div>
        ) : null}
      </div>
    </main>
  );
}
