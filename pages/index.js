import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const BUILD_TAG = "35.3.8";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
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

  // auth instrumentation
  const [authNote, setAuthNote] = useState("");
  const emailInputRef = useRef(null);
  const signBtnRef = useRef(null);

  // debug panel + traces
  const [trace, setTrace] = useState([]);
  const [mutations, setMutations] = useState([]);
  const [debugPanel, setDebugPanel] = useState({
    lastStatus: "",
    lastMutation: "",
    overrideDetected: false,
  });
  const [urlDebug, setUrlDebug] = useState({
    search: "",
    hash: "",
    handled: "",
    error: "",
  });

  const statusTextRef = useRef(null);
  const lastClickRef = useRef({ t: 0, target: "" });

  // global click tracker
  useEffect(() => {
    const onDocClick = (e) => {
      lastClickRef.current = {
        t: performance.now(),
        target: e?.target?.outerHTML?.slice(0, 120) || String(e?.target || ""),
      };
    };
    document.addEventListener("click", onDocClick, true);
    return () => document.removeEventListener("click", onDocClick, true);
  }, []);

  // Wrap setStatus with console log and trace
  const setStatus = (next) => {
    const nextVal = typeof next === "function" ? next(status) : next;

    let caller = "unknown";
    try {
      const err = new Error();
      if (err.stack) {
        const lines = err.stack.split("\n");
        const hint = (lines[2] || lines[1] || "").trim().replace(/^at\s+/, "");
        caller = hint;
      }
    } catch {}

    const entry = {
      t: new Date().toLocaleTimeString(),
      kind: nextVal?.kind,
      text: String(nextVal?.text ?? ""),
      caller,
    };

    try {
      console.log(`[Build ${BUILD_TAG}] status-trace`, entry);
    } catch {}
    setTrace((prev) => [entry, ...prev].slice(0, 12));
    setDebugPanel((p) => ({ ...p, lastStatus: `${entry.kind}: ${entry.text}` }));

    _setStatus(nextVal);

    setTimeout(() => {
      const nowText = statusTextRef.current?.textContent ?? "";
      if (nextVal?.text && nowText && nowText !== nextVal.text) {
        setDebugPanel((p) => ({
          ...p,
          overrideDetected: true,
          lastMutation: `post-set snapshot saw '${nowText}' (expected '${nextVal.text}')`,
        }));
        try {
          console.log(`[Build ${BUILD_TAG}] status-post-snapshot`, { expected: nextVal.text, saw: nowText });
        } catch {}
      }
    }, 0);
  };

  // Observe DOM changes to the status text element
  useEffect(() => {
    const el = statusTextRef.current;
    if (!el) return;
    const obs = new MutationObserver(() => {
      const entry = {
        t: new Date().toLocaleTimeString(),
        text: el.textContent,
        sinceClickMs: Math.round(performance.now() - (lastClickRef.current.t || 0)),
        lastClickTarget: lastClickRef.current.target,
      };
      setMutations((prev) => [entry, ...prev].slice(0, 12));
      setDebugPanel((p) => ({
        ...p,
        lastMutation: `${entry.text} (+${entry.sinceClickMs}ms after click on ${entry.lastClickTarget || "n/a"})`,
      }));
      try {
        console.log(`[Build ${BUILD_TAG}] status-mutation`, entry);
      } catch {}
    });
    obs.observe(el, { characterData: true, subtree: true, childList: true });
    return () => obs.disconnect();
  }, [session?.user?.id]);

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

  // Handle magic link redirect: support both `?code=` and `#access_token=...`
  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    const searchParams = new URLSearchParams(url.search);
    const hashStr = window.location.hash?.startsWith("#") ? window.location.hash.slice(1) : window.location.hash || "";
    const hashParams = new URLSearchParams(hashStr);

    const dbg = {
      search: [...searchParams.entries()].map(([k, v]) => `${k}=${v}`).join("&") || "(none)",
      hash: [...hashParams.entries()].map(([k, v]) => `${k}=${k === "access_token" || k === "refresh_token" ? "[redacted]" : v}`).join("&") || "(none)",
      handled: "",
      error: "",
    };
    setUrlDebug(dbg);

    const errorDesc = searchParams.get("error_description") || searchParams.get("error");
    if (errorDesc) {
      setStatus({ kind: "error", text: `Auth redirect error: ${decodeURIComponent(errorDesc)}` });
      setUrlDebug((p) => ({ ...p, error: String(errorDesc) }));
      return;
    }

    const code = searchParams.get("code");
    const access_token = hashParams.get("access_token");
    const refresh_token = hashParams.get("refresh_token");

    (async () => {
      try {
        if (code) {
          setStatus({ kind: "info", text: "Finalizing sign in..." });
          const { data, error } = await supabase.auth.exchangeCodeForSession({ code });
          if (error) {
            setStatus({ kind: "error", text: `Auth exchange error: ${error.message}` });
            setUrlDebug((p) => ({ ...p, handled: "code: error" }));
            return;
          }
          if (data?.session) {
            setStatus({ kind: "success", text: "Signed in. You can upload now." });
            setUrlDebug((p) => ({ ...p, handled: "code: success" }));
          }
        } else if (access_token && refresh_token) {
          setStatus({ kind: "info", text: "Restoring session..." });
          const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) {
            setStatus({ kind: "error", text: `Set session error: ${error.message}` });
            setUrlDebug((p) => ({ ...p, handled: "hash tokens: error" }));
            return;
          }
          if (data?.session) {
            setStatus({ kind: "success", text: "Signed in. You can upload now." });
            setUrlDebug((p) => ({ ...p, handled: "hash tokens: success" }));
          }
        }
      } finally {
        // Clean URL
        try {
          url.searchParams.delete("code");
          url.searchParams.delete("type");
          url.searchParams.delete("error_description");
          const cleaned = url.origin + url.pathname + (url.searchParams.toString() ? "?" + url.searchParams.toString() : "") + "";
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

  // Redundant native listener to guarantee clicks are handled
  useEffect(() => {
    const btn = signBtnRef.current;
    if (!btn) return;
    const handler = (ev) => {
      console.log(`[Build ${BUILD_TAG}] native click on sign button`);
      sendMagicLink(ev);
    };
    btn.addEventListener("click", handler);
    return () => btn.removeEventListener("click", handler);
  }, [isSignUp, email]);

  async function sendMagicLink(e) {
    if (e && typeof e.preventDefault === "function") e.preventDefault();

    const eaddr = (email || emailInputRef.current?.value || "").trim();
    if (eaddr !== email) setEmail(eaddr);

    const mode = isSignUp ? "sign-up" : "sign-in";
    setAuthNote(`clicked ${mode} at ${new Date().toLocaleTimeString()} email='${eaddr}'`);
    console.log(`[Build ${BUILD_TAG}] auth submit`, { mode: isSignUp ? "signup" : "signin", email: eaddr });

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
    const maxBytes = 10 * 1024 * 1024;
    if (f.size > maxBytes) {
      setFile(null);
      setStatus({ kind: "error", text: "Choose a JPEG or PNG under 10 MB." });
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

      await fetchFiles();

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
          return { name: it.name, path: fullPath, url: urlData?.publicUrl || "" };
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

  function DebugPanel() {
    return (
      <div
        style={{
          position: "fixed",
          bottom: 8,
          right: 8,
          zIndex: 9999,
          maxWidth: 360,
          background: "#111",
          color: "#fff",
          borderRadius: 12,
          padding: 10,
          boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
          fontSize: 12,
          lineHeight: 1.3,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Debug • Build {BUILD_TAG}</div>
        <div><strong>Last status:</strong> {debugPanel.lastStatus || "(none)"} </div>
        <div><strong>Last mutation:</strong> {debugPanel.lastMutation || "(none)"} </div>
        <div><strong>Override detected:</strong> {debugPanel.overrideDetected ? "yes" : "no"} </div>
        <div style={{ marginTop: 6 }}>
          <details>
            <summary>Trace (latest 6)</summary>
            <ul style={{ paddingLeft: 16, margin: 0 }}>
              {trace.slice(0, 6).map((e, i) => (
                <li key={i}><code>[{e.t}] ({e.kind}) {e.text}</code></li>
              ))}
            </ul>
          </details>
        </div>
        <div style={{ marginTop: 6 }}>
          <details open>
            <summary>URL debug</summary>
            <ul style={{ paddingLeft: 16, margin: 0 }}>
              <li>search: <code>{urlDebug.search}</code></li>
              <li>hash: <code>{urlDebug.hash}</code></li>
              <li>handled: <code>{urlDebug.handled}</code></li>
              <li>error: <code>{urlDebug.error || "(none)"}</code></li>
            </ul>
          </details>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 840, margin: "24px auto", padding: "0 16px", fontFamily: "system-ui, Arial, sans-serif" }}>
      <DebugPanel />

      <header style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 4, marginBottom: 16, textAlign: "center" }}>
        <h1 style={{ margin: 0 }}>The Scope of Morgellons</h1>
        <div style={{ fontSize: 12, opacity: 0.8 }}>Build {BUILD_TAG}</div>
      </header>

      {!session ? (
        <section style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <h2 style={{ marginTop: 0 }}>{isSignUp ? "Sign up" : "Sign in"}</h2>

          <form onSubmit={(e) => e.preventDefault()}>
            <label htmlFor="email" style={{ display: "block", marginBottom: 8 }}>Email</label>
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
              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #ccc", marginBottom: 12 }}
            />
            <button
              ref={signBtnRef}
              type="button"
              onClick={sendMagicLink}
              style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #333", background: "#111", color: "#fff", cursor: "pointer", marginRight: 8 }}
            >
              {isSignUp ? "Sign up" : "Sign in"}
            </button>
            <button
              type="button"
              onClick={() => setIsSignUp((s) => !s)}
              style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #ccc", background: "#fafafa", cursor: "pointer" }}
            >
              {isSignUp ? "Sign in" : "Sign up"}
            </button>
          </form>

          {status.text ? (
            <div role="status" aria-live="polite" style={{
              marginTop: 12, padding: 12, borderRadius: 8,
              border: status.kind === "error" ? "1px solid #ef4444" : status.kind === "success" ? "1px solid #10b981" : "1px solid #d4d4d4",
              background: status.kind === "error" ? "#fef2f2" : status.kind === "success" ? "#f0fdf4" : "#fafafa", color: "#111",
            }}>
              <strong style={{ display: "block", marginBottom: 4 }}>
                {status.kind === "error" ? "Error" : status.kind === "success" ? "Success" : "Info"}
              </strong>
              <div ref={statusTextRef}>{status.text}</div>
            </div>
          ) : null}

          <div style={{ marginTop: 8, fontSize: 12, color: "#555" }}>
            Auth debug: mode={isSignUp ? "sign-up" : "sign-in"} {authNote ? `last=${authNote}` : ""}
          </div>
        </section>
      ) : (
        <>
          <section style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>Uploader</h2>
              <SignOutButton />
            </div>

            <form onSubmit={handleUpload}>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" onChange={onFileChange} style={{ display: "block", marginBottom: 12 }} />

              <div aria-hidden style={{ height: 10, borderRadius: 6, background: "#f0f0f0", overflow: "hidden", marginBottom: 12 }}>
                <div style={{ height: "100%", width: `${progress}%`, background: "#0ea5e9", transition: "width 200ms linear" }} />
              </div>

              <button type="submit" disabled={uploading} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #333", background: uploading ? "#999" : "#111", color: "#fff", cursor: uploading ? "not-allowed" : "pointer" }}>
                {uploading ? "Uploading..." : "Upload"}
              </button>
            </form>

            <div style={{
              marginTop: 12, padding: 12, borderRadius: 8,
              border: status.kind === "error" ? "1px solid #ef4444" : status.kind === "success" ? "1px solid #10b981" : "1px solid #d4d4d4",
              background: status.kind === "error" ? "#fef2f2" : status.kind === "success" ? "#f0fdf4" : "#fafafa", color: "#111",
            }}>
              <strong style={{ display: "block", marginBottom: 4 }}>
                {status.kind === "error" ? "Error" : status.kind === "success" ? "Success" : "Info"}
              </strong>
              <div ref={statusTextRef}>{status.text || " "}</div>
            </div>

            <div style={{ marginTop: 8, fontSize: 12, color: "#555" }}>
              <div>Status debug: kind={String(status.kind)} text={"'" + String(status.text) + "'"}</div>
              <div>Status raw: [{String(status.kind)}] {String(status.text)}</div>
              <div style={{ opacity: 0.8 }}>User prefix: {userPrefix || "(none)"} </div>
            </div>

            <div style={{ marginTop: 8, fontSize: 12, color: "#333", background: "#fafafa", border: "1px dashed #ddd", borderRadius: 8, padding: 8 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Status trace</div>
              {trace.length === 0 ? <div style={{ color: "#777" }}>No entries yet.</div> : (
                <ol style={{ margin: 0, paddingLeft: 16 }}>
                  {trace.map((e, idx) => (
                    <li key={idx} style={{ marginBottom: 4, wordBreak: "break-word" }}>
                      <code>[{e.t}] ({e.kind}) {e.text} - {e.caller}</code>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div style={{ marginTop: 8, fontSize: 12, color: "#333", background: "#fff7ed", border: "1px dashed #f59e0b", borderRadius: 8, padding: 8 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Status DOM mutations</div>
              {mutations.length === 0 ? <div style={{ color: "#777" }}>No DOM changes observed.</div> : (
                <ol style={{ margin: 0, paddingLeft: 16 }}>
                  {mutations.map((m, idx) => (
                    <li key={idx} style={{ marginBottom: 4, wordBreak: "break-word" }}>
                      <code>[{m.t}] {m.text}</code>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>

          <section style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <h2 style={{ marginTop: 0 }}>Your images</h2>
            {files.length === 0 ? (
              <div style={{ color: "#666" }}>No images yet.</div>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
                {files.map((f) => (
                  <li key={f.path} style={{ border: "1px solid #eee", borderRadius: 8, padding: 8 }}>
                    <div style={{ fontSize: 12, marginBottom: 6, wordBreak: "break-word" }}>{f.name}</div>
                    {f.url ? (
                      <img src={f.url} alt={f.name} style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 6, display: "block" }} loading="lazy" />
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















