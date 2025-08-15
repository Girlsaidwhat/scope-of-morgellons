// pages/index.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase =
  typeof window !== "undefined"
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      )
    : null;

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png"];
const BUCKET = "images";
const META_TABLE = "image_metadata";
const BUILD_TAG = "34.30";

const styles = {
  page: {
    maxWidth: 960,
    margin: "0 auto",
    padding: 16,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    lineHeight: 1.45,
  },
  h1: { fontSize: 24, fontWeight: 700, marginBottom: 4 },
  subtle: { color: "#6b7280", fontSize: 14, marginBottom: 12 },
  card: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    background: "#fff",
  },
  row: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  input: {
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    fontSize: 14,
    minWidth: 260,
  },
  btn: {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #111827",
    backgroundColor: "#111827",
    color: "white",
    cursor: "pointer",
    fontSize: 14,
  },
  btnGhost: {
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    backgroundColor: "#f9fafb",
    cursor: "pointer",
    fontSize: 13,
  },
  tabs: {
    display: "inline-flex",
    gap: 6,
    background: "#f3f4f6",
    padding: 6,
    borderRadius: 999,
    marginBottom: 8,
  },
  tab: (active) => ({
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 13,
    cursor: "pointer",
    border: active ? "1px solid #111827" : "1px solid transparent",
    background: active ? "#111827" : "transparent",
    color: active ? "#fff" : "#111827",
  }),
  status: {
    base: {
      padding: "10px 12px",
      borderRadius: 8,
      marginTop: 10,
      fontSize: 14,
    },
    info: { background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e3a8a" },
    success: { background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46" },
    error: { background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" },
  },
  progressWrap: {
    height: 8,
    width: "100%",
    backgroundColor: "#f3f4f6",
    borderRadius: 9999,
    overflow: "hidden",
    marginTop: 8,
  },
  progressBar: (pct) => ({
    height: "100%",
    width: `${pct}%`,
    backgroundColor: "#111827",
    transition: "width 0.2s ease",
  }),
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
    gap: 12,
  },
  thumb: {
    width: "100%",
    height: 140,
    objectFit: "cover",
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
  },
  listItem: { fontSize: 12, color: "#6b7280" },
  fileLine: { fontSize: 13, color: "#374151", marginTop: 6 },
  footer: { color: "#9ca3af", fontSize: 12, marginTop: 6 },
};

function Status({ kind = "info", children }) {
  const style = {
    ...styles.status.base,
    ...(kind === "success"
      ? styles.status.success
      : kind === "error"
      ? styles.status.error
      : styles.status.info),
  };
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={style}
    >
      {children}
    </div>
  );
}

export default function HomePage() {
  const [session, setSession] = useState(null);
  const [authMode, setAuthMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState({ kind: "info", msg: "" });
  const [files, setFiles] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [pickedName, setPickedName] = useState("");
  const progressTimerRef = useRef(null);
  const authSubRef = useRef(null);

  const userId = session?.user?.id || null;
  const prefix = useMemo(() => (userId ? `${userId}/` : ""), [userId]);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const s = data.session || null;
      setSession(s);
      if (s?.user?.id) refreshList(s.user.id);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession) {
        setFiles([]);
      } else if (newSession.user?.id) {
        refreshList(newSession.user.id);
      }
    });
    authSubRef.current = listener?.subscription || null;

    return () => {
      mounted = false;
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      authSubRef.current?.unsubscribe?.();
    };
  }, []);

  async function refreshList(uid = userId) {
    if (!uid || !supabase) return;
    setLoadingList(true);
    const { data, error } = await supabase.storage.from(BUCKET).list(uid, {
      limit: 200,
      sortBy: { column: "name", order: "desc" },
    });
    if (error) {
      setStatus({ kind: "error", msg: "Could not load your images." });
      setLoadingList(false);
      return;
    }
    setFiles(Array.isArray(data) ? data : []);
    setLoadingList(false);
  }

  useEffect(() => {
    if (userId) refreshList(userId);
  }, [userId]);

  async function handleSignIn(e) {
    e.preventDefault();
    if (!email) return setStatus({ kind: "error", msg: "Enter your email." });
    setStatus({ kind: "info", msg: "Sending sign in link to your email." });
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) return setStatus({ kind: "error", msg: error.message });
    setStatus({ kind: "success", msg: "Check your email for the sign in link." });
  }

  async function handleSignUp(e) {
    e.preventDefault();
    if (!email) return setStatus({ kind: "error", msg: "Enter your email." });
    setStatus({ kind: "info", msg: "Creating your account." });
    const { error } = await supabase.auth.signUp({ email });
    if (error) return setStatus({ kind: "error", msg: error.message });
    setStatus({ kind: "success", msg: "Check your email to confirm your account." });
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setStatus({ kind: "success", msg: "Signed out." });
  }

  function formatMB(bytes) {
    return (bytes / (1024 * 1024)).toFixed(1);
  }

  // Upload with validations and faux progress, then record to image_metadata
  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPickedName(file.name);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setStatus({ kind: "error", msg: "Only JPEG and PNG are allowed." });
      e.target.value = "";
      setPickedName("");
      return;
    }
    if (file.size > MAX_BYTES) {
      setStatus({
        kind: "error",
        msg: `File is too large. Max size is 10 MB. This file is ${formatMB(file.size)} MB.`,
      });
      e.target.value = "";
      setPickedName("");
      return;
    }
    if (!userId) {
      setStatus({ kind: "error", msg: "You need to sign in first." });
      e.target.value = "";
      setPickedName("");
      return;
    }

    setUploading(true);
    setProgress(0);
    setStatus({ kind: "info", msg: "Uploading..." });

    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    progressTimerRef.current = setInterval(() => {
      setProgress((p) => {
        const next = p + Math.max(1, Math.floor(Math.random() * 7));
        return next >= 90 ? 90 : next;
      });
    }, 180);

    const path = `${userId}/${file.name}`;

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type,
    });

    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    setProgress(100);
    setUploading(false);

    if (uploadError) {
      console.error("upload error", uploadError);
      setStatus({ kind: "error", msg: uploadError.message || "Upload failed." });
      return;
    }

    const { error: metaError } = await supabase.from(META_TABLE).insert([{ user_id: userId, path }]);

    if (metaError) {
      console.error("metadata insert error", metaError);
      setStatus({ kind: "success", msg: `Upload complete. Could not save metadata. [${BUILD_TAG}]` });
    } else {
      setStatus({ kind: "success", msg: `Upload complete. Saved to library. [${BUILD_TAG}]` });
    }

    await refreshList();
    e.target.value = "";
    setPickedName("");
    setTimeout(() => setProgress(0), 600);
  }

  function publicUrlFor(name) {
    if (!userId) return "#";
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(`${userId}/${name}`);
    return data?.publicUrl || "#";
  }

  return (
    <main style={styles.page}>
      <h1 style={styles.h1}>The Scope of Morgellons</h1>
      <p style={styles.subtle}>Signed uploads, per user folders, simple gallery.</p>
      <p style={styles.footer}>Build {BUILD_TAG}</p>

      {!session ? (
        <section aria-label="authentication" style={styles.card}>
          <div style={styles.tabs} role="tablist" aria-label="Auth mode">
            <button
              role="tab"
              aria-selected={authMode === "signin"}
              style={styles.tab(authMode === "signin")}
              onClick={() => setAuthMode("signin")}
            >
              Sign in
            </button>
            <button
              role="tab"
              aria-selected={authMode === "signup"}
              style={styles.tab(authMode === "signup")}
              onClick={() => setAuthMode("signup")}
            >
              Sign up
            </button>
          </div>

          <form
            onSubmit={authMode === "signin" ? handleSignIn : handleSignUp}
            aria-label={authMode === "signin" ? "Sign in form" : "Sign up form"}
          >
            <div style={{ ...styles.row, marginTop: 6 }}>
              <label htmlFor="email" className="sr-only">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.input}
              />
              <button type="submit" style={styles.btn}>
                {authMode === "signin" ? "Send sign in link" : "Send confirmation link"}
              </button>
            </div>
          </form>

          {status.msg ? <Status kind={status.kind}>{status.msg}</Status> : null}
        </section>
      ) : (
        <>
          <section style={styles.card} aria-label="account">
            <div style={{ ...styles.row, justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 600 }}>Signed in</div>
                <div style={styles.listItem}>User id prefix: {prefix}</div>
              </div>
              <button onClick={handleSignOut} style={styles.btnGhost}>
                Sign out
              </button>
            </div>
          </section>

          <section style={styles.card} aria-label="uploader">
            <div style={{ marginBottom: 6, fontWeight: 600 }}>Upload an image</div>
            <div style={{ ...styles.subtle, marginBottom: 4 }}>
              Allowed types: JPEG and PNG. Max size: 10 MB.
            </div>

            <div style={{ ...styles.row, marginTop: 8 }}>
              <label htmlFor="file" className="sr-only">
                Choose file
              </label>
              <input
                id="file"
                type="file"
                accept="image/jpeg,image/png"
                onChange={handleFileChange}
                disabled={uploading}
                style={{ ...styles.input, padding: 6 }}
              />
            </div>

            {pickedName ? <div style={styles.fileLine}>Selected file: {pickedName}</div> : null}

            {uploading || progress > 0 ? (
              <div style={styles.progressWrap} aria-label="upload progress" aria-valuenow={progress}>
                <div style={styles.progressBar(progress)} />
              </div>
            ) : null}

            {status.msg ? <Status kind={status.kind}>{status.msg}</Status> : null}
          </section>

          <section style={styles.card} aria-label="gallery">
            <div style={{ marginBottom: 10, fontWeight: 600 }}>Your images</div>
            {loadingList ? (
              <Status kind="info">Loading your images...</Status>
            ) : files.length === 0 ? (
              <div style={styles.subtle}>No images yet.</div>
            ) : (
              <div style={styles.grid}>
                {files.map((f) => (
                  <figure key={f.name}>
                    <img
                      src={publicUrlFor(f.name)}
                      alt={f.name}
                      loading="lazy"
                      style={styles.thumb}
                    />
                    <figcaption style={styles.listItem}>{f.name}</figcaption>
                  </figure>
                ))}
              </div>
            )}
            <div style={styles.footer}>Images load from Supabase Storage</div>
          </section>
        </>
      )}
    </main>
  );
}




