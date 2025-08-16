import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const BUILD_TAG = "35.3.10";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Manual redirect handling stays on. No debug UI.
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

export default function Home() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  const [file, setFile] = useState(null);
  const [status, _setStatus] = useState({ kind: "info", text: "" });
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const [files, setFiles] = useState([]);
  const progressTimerRef = useRef(null);
  const fileInputRef = useRef(null);
  const emailInputRef = useRef(null);
  const signBtnRef = useRef(null);
  const statusTextRef = useRef(null);

  // Minimal setStatus wrapper
  const setStatus = (next) => {
    const nextVal = typeof next === "function" ? next(status) : next;
    _setStatus(nextVal);
  };

  // Session management
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Handle magic link redirects: support ?code=, #access_token, and token_hash+type
  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    const searchParams = new URLSearchParams(url.search);
    const hashStr = window.location.hash?.startsWith("#") ? window.location.hash.slice(1) : window.location.hash || "";
    const hashParams = new URLSearchParams(hashStr);

    const errorDesc = searchParams.get("error_description") || searchParams.get("error");
    if (errorDesc) {
      setStatus({ kind: "error", text: `Auth redirect error: ${decodeURIComponent(errorDesc)}` });
      return;
    }

    const code = searchParams.get("code");
    const access_token = hashParams.get("access_token");
    const refresh_token = hashParams.get("refresh_token");
    const token_hash = searchParams.get("token_hash");
    const vtype = searchParams.get("type");

    (async () => {
      try {
        if (code) {
          setStatus({ kind: "info", text: "Finalizing sign in..." });
          const { data, error } = await supabase.auth.exchangeCodeForSession({ code });
          if (error) {
            setStatus({ kind: "error", text: `Auth exchange error: ${error.message}` });
            return;
          }
          if (data?.session) setStatus({ kind: "success", text: "Signed in. You can upload now." });
        } else if (access_token && refresh_token) {
          setStatus({ kind: "info", text: "Restoring session..." });
          const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) {
            setStatus({ kind: "error", text: `Set session error: ${error.message}` });
            return;
          }
          if (data?.session) setStatus({ kind: "success", text: "Signed in. You can upload now." });
        } else if (token_hash && vtype) {
          setStatus({ kind: "info", text: "Verifying link..." });
          const { data, error } = await supabase.auth.verifyOtp({ type: vtype, token_hash });
          if (error) {
            setStatus({ kind: "error", text: `Verify link error: ${error.message}` });
            return;
          }
          if (data?.session) setStatus({ kind: "success", text: "Signed in. You can upload now." });
        }
      } finally {
        // Clean URL
        try {
          url.searchParams.delete("code");
          url.searchParams.delete("type");
          url.searchParams.delete("error_description");
          url.searchParams.delete("token_hash");
          const cleaned = url.origin + url.pathname + (url.searchParams.toString() ? "?" + url.searchParams.toString() : "");
          window.history.replaceState({}, "", cleaned);
          if (window.location.hash) window.history.replaceState({}, "", cleaned);
        } catch {}
      }
    })();
  }, []);

  // Load gallery when signed in
  useEffect(() => {
    if (!session?.user?.id) return;
    fetchFiles();
  }, [session?.user?.id]);

  const userPrefix = useMemo(
    () => (session?.user?.id ? `${session.user.id}/` : ""),
    [session?.user?.id]
  );

  // Send magic link
  async function sendMagicLink(e) {
    if (e && typeof e.preventDefault === "function") e.preventDefault();

    const eaddr = (email || emailInputRef.current?.value || "").trim();
    if (eaddr !== email) setEmail(eaddr);

    if (!eaddr) {
      setStatus({ kind: "error", text: "Enter your email first." });
      return;
    }

    setStatus({ kind: "info", text: isSignUp ? "Sending sign up link..." : "Attempting sign in..." });

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email: eaddr,
          options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
        });
        if (error) throw error;
        setStatus({ kind: "success", text: "Check your email to complete sign up." });
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email: eaddr,
          options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
        });
        if (error) throw error;
        setStatus({ kind: "success", text: "Magic link sent. Check your email." });
      }
    } catch (err) {
      setStatus({ kind: "error", text: `Auth error: ${err.message}` });
    }
  }

  // File selection and checks
  function onFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;

    const isJpeg = f.type === "image/jpeg";
    const isPng = f.type === "image/png";
    if (!isJpeg && !isPng) {
      setFile(null);
      setStatus({ kind: "error", text: "Only JPEG or PNG files are allowed." });
      e.target.value = "";
      return;
    }
    const maxBytes = 10 * 1024 * 1024; // 10 MB
    if (f.size > maxBytes) {
      setFile(null);
      setStatus({ kind: "error", text: "Choose a JPEG or PNG under 10 MB." });
      e.target.value = "";
      return;
    }

    setFile(f);
    setStatus({ kind: "info", text: `Selected: ${f.name}` });
  }

  // Faux progress
  function startFauxProgress() {
    setProgress(1);
    clearInterval(progressTimerRef.current);
    progressTimerRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 90) return p;
        const bump = Math.max(1, Math.floor(Math.random() * 7));
        return Math.min(90, p + bump);
      });
    }, 200);
  }

  function stopFauxProgress(to = 100) {
    clearInterval(progressTimerRef.current);
    setProgress(to);
  }

  // Upload
  async function handleUpload(e) {
    e.preventDefault();
    if (!session?.user?.id) {
      setStatus({ kind: "error", text: "Please sign in first." });
      return;
    }
    if (!file) {
      setStatus({ kind: "error", text: "Choose a JPEG or PNG under 10 MB." });
      return;
    }

    try {
      setUploading(true);
      setStatus({ kind: "info", text: "Uploading..." });
      startFauxProgress();

      const path = `${userPrefix}${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("images")
        .upload(path, file, {
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Metadata insert after successful upload
      const { error: dbError } = await supabase.from("image_metadata").insert({
        user_id: session.user.id,
        bucket: "images",
        path,
        filename: file.name,
        content_type: file.type,
        size_bytes: file.size,
      });
      if (dbError) {
        // Non fatal to the user flow
      }

      stopFauxProgress(100);
      setStatus({ kind: "success", text: `Upload complete. Saved to library. [Build ${BUILD_TAG}]` });

      // Refresh gallery
      await fetchFiles();

      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = "";
      setFile(null);
      setUploading(false);
    } catch (err) {
      stopFauxProgress(0);
      setUploading(false);
      setStatus({ kind: "error", text: `Upload failed: ${err.message}` });
    }
  }

  // List files
  async function fetchFiles() {
    if (!session?.user?.id) return;
    try {
      const { data, error } = await supabase.storage.from("images").list(userPrefix, {
        limit: 100,
        sortBy: { column: "created_at", order: "desc" },
      });
      if (error) throw error;
      const items = Array.isArray(data) ? data : [];
      const withUrls = items
        .filter((it) => it?.name)
        .map((it) => {
          const fullPath = `${userPrefix}${it.name}`;
          const { data: urlData } = supabase.storage.from("images").getPublicUrl(fullPath);
          return {
            name: it.name,
            path: fullPath,
            url: urlData?.publicUrl || "",
          };
        });
      setFiles(withUrls);
    } catch {
      setFiles([]);
    }
  }

  function SignOutButton() {
    return (
      <button
        onClick={async () => {
          await supabase.auth.signOut();
        }}
        style={{
          padding: "8px 12px",
          borderRadius: 8,
          border: "1px solid #ccc",
          background: "#fafafa",
          cursor: "pointer",
        }}
      >
        Sign out
      </button>
    );
  }

  return (
    <div style={{ maxWidth: 840, margin: "24px auto", padding: "0 16px", fontFamily: "system-ui, Arial, sans-serif" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 4, marginBottom: 16, textAlign: "center" }}>
        <h1 style={{ margin: 0 }}>The Scope of Morgellons</h1>
        <div style={{ fontSize: 12, opacity: 0.8 }}>Build {BUILD_TAG}</div>
      </header>

      {!session ? (
        <section
          style={{
            border: "1px solid #e5e5e5",
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <h2 style={{ marginTop: 0 }}>{isSignUp ? "Sign up" : "Sign in"}</h2>

          <form onSubmit={(e) => e.preventDefault()}>
            <label htmlFor="email" style={{ display: "block", marginBottom: 8 }}>
              Email
            </label>
            <input
              ref={emailInputRef}
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              spellCheck="false"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #ccc",
                marginBottom: 12,
              }}
            />
            <button
              ref={signBtnRef}
              type="button"
              onClick={sendMagicLink}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #333",
                background: "#111",
                color: "#fff",
                cursor: "pointer",
                marginRight: 8,
              }}
            >
              {isSignUp ? "Sign up" : "Sign in"}
            </button>
            <button
              type="button"
              onClick={() => setIsSignUp((s) => !s)}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #ccc",
                background: "#fafafa",
                cursor: "pointer",
              }}
            >
              {isSignUp ? "Sign in" : "Sign up"}
            </button>
          </form>

          {status.text ? (
            <div
              role="status"
              aria-live="polite"
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 8,
                border:
                  status.kind === "error"
                    ? "1px solid #ef4444"
                    : status.kind === "success"
                    ? "1px solid #10b981"
                    : "1px solid #d4d4d4",
                background:
                  status.kind === "error"
                    ? "#fef2f2"
                    : status.kind === "success"
                    ? "#f0fdf4"
                    : "#fafafa",
                color: "#111",
              }}
            >
              <strong style={{ display: "block", marginBottom: 4 }}>
                {status.kind === "error" ? "Error" : status.kind === "success" ? "Success" : "Info"}
              </strong>
              <div ref={statusTextRef}>{status.text}</div>
            </div>
          ) : null}
        </section>
      ) : (
        <>
          <section
            style={{
              border: "1px solid #e5e5e5",
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>Uploader</h2>
              <SignOutButton />
            </div>

            <form onSubmit={handleUpload}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                onChange={onFileChange}
                style={{ display: "block", marginBottom: 12 }}
              />

              {/* Faux progress bar */}
              <div
                aria-hidden
                style={{
                  height: 10,
                  borderRadius: 6,
                  background: "#f0f0f0",
                  overflow: "hidden",
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${progress}%`,
                    background: "#0ea5e9",
                    transition: "width 200ms linear",
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={uploading}
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid #333",
                  background: uploading ? "#999" : "#111",
                  color: "#fff",
                  cursor: uploading ? "not-allowed" : "pointer",
                }}
              >
                {uploading ? "Uploading..." : "Upload"}
              </button>
            </form>

            {/* Styled status box */}
            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 8,
                border:
                  status.kind === "error"
                    ? "1px solid #ef4444"
                    : status.kind === "success"
                    ? "1px solid #10b981"
                    : "1px solid #d4d4d4",
                background:
                  status.kind === "error"
                    ? "#fef2f2"
                    : status.kind === "success"
                    ? "#f0fdf4"
                    : "#fafafa",
                color: "#111",
              }}
            >
              <strong style={{ display: "block", marginBottom: 4 }}>
                {status.kind === "error" ? "Error" : status.kind === "success" ? "Success" : "Info"}
              </strong>
              <div ref={statusTextRef}>{status.text || " "}</div>
            </div>

            {/* Gallery */}
            <section
              style={{
                marginTop: 16,
                border: "1px solid #e5e5e5",
                borderRadius: 12,
                padding: 16,
              }}
            >
              <h2 style={{ marginTop: 0 }}>Your images</h2>
              {files.length === 0 ? (
                <div style={{ color: "#666" }}>No images yet.</div>
              ) : (
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                    gap: 12,
                  }}
                >
                  {files.map((f) => (
                    <li key={f.path} style={{ border: "1px solid #eee", borderRadius: 8, padding: 8 }}>
                      <div style={{ fontSize: 12, marginBottom: 6, wordBreak: "break-word" }}>{f.name}</div>
                      {f.url ? (
                        <img
                          src={f.url}
                          alt={f.name}
                          style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 6, display: "block" }}
                          loading="lazy"
                        />
                      ) : (
                        <div style={{ fontSize: 12, color: "#999" }}>No preview</div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </section>
        </>
      )}

      <footer style={{ fontSize: 12, color: "#777", textAlign: "center", marginTop: 24 }}>
        &copy; {new Date().getFullYear()} The Scope of Morgellons
      </footer>
    </div>
  );
}

















