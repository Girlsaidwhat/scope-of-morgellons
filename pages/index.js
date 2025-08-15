import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const BUILD_TAG = "35.2";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

  // Wrap setStatus with a console.log for instrumentation
  const setStatus = (next) => {
    const nextVal = typeof next === "function" ? next(status) : next;
    try {
      console.log(`[Build ${BUILD_TAG}] setStatus`, {
        kind: nextVal?.kind,
        text: nextVal?.text,
        time: new Date().toISOString(),
      });
    } catch {}
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

  // Load gallery when signed in
  useEffect(() => {
    if (!session?.user?.id) return;
    fetchFiles();
  }, [session?.user?.id]);

  const userPrefix = useMemo(
    () => (session?.user?.id ? `${session.user.id}/` : ""),
    [session?.user?.id]
  );

  async function sendMagicLink(e) {
    e.preventDefault();
    if (!email) {
      setStatus({ kind: "error", text: "Enter your email first." });
      return;
    }
    setStatus({ kind: "info", text: isSignUp ? "Sending sign up link..." : "Sending sign in link..." });

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          options: {
            emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
          },
        });
        if (error) throw error;
        setStatus({ kind: "success", text: "Check your email to complete sign up." });
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
          },
        });
        if (error) throw error;
        setStatus({ kind: "success", text: "Magic link sent. Check your email." });
      }
    } catch (err) {
      setStatus({ kind: "error", text: `Auth error: ${err.message}` });
    }
  }

  function onFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;

    // Client file type and size checks
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
      setStatus({ kind: "error", text: "File is larger than 10 MB." });
      e.target.value = "";
      return;
    }

    setFile(f);
    setStatus({ kind: "info", text: `Selected: ${f.name}` });
  }

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

      // Insert metadata row after successful upload
      const { error: dbError } = await supabase.from("image_metadata").insert({
        user_id: session.user.id,
        bucket: "images",
        path,
        filename: file.name,
        content_type: file.type,
        size_bytes: file.size,
      });
      if (dbError) {
        console.warn(`[Build ${BUILD_TAG}] image_metadata insert warning`, dbError);
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
    } catch (err) {
      console.error(`[Build ${BUILD_TAG}] list error`, err);
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
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
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
          <form onSubmit={sendMagicLink}>
            <label htmlFor="email" style={{ display: "block", marginBottom: 8 }}>
              Email
            </label>
            <input
              id="email"
              type="email"
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
              type="submit"
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
              {isSignUp ? "Send sign up link" : "Send magic link"}
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
              {isSignUp ? "Use sign in" : "Use sign up"}
            </button>
          </form>
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
              <div>{status.text || " "}</div>
            </div>

            {/* Always-on debug lines for signed-in users */}
            <div style={{ marginTop: 8, fontSize: 12, color: "#555" }}>
              <div>Status debug: kind={String(status.kind)} text={"'" + String(status.text) + "'"}</div>
              <div>Status raw: [{String(status.kind)}] {String(status.text)}</div>
              <div style={{ opacity: 0.8 }}>User prefix: {userPrefix || "(none)"}</div>
            </div>
          </section>

          <section
            style={{
              border: "1px solid #e5e5e5",
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <h2 style={{ marginTop: 0 }}>Your images</h2>
            {files.length === 0 ? (
              <div style={{ color: "#666" }}>No images yet.</div>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
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
        </>
      )}

      <footer style={{ fontSize: 12, color: "#777", textAlign: "center", marginTop: 24 }}>
        &copy; {new Date().getFullYear()} The Scope of Morgellons
      </footer>
    </div>
  );
}






