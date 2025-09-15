// pages/signin.js
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

// Create a browser-side Supabase client with session persistence
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "sb-scope-auth", // custom key to avoid collisions
    },
  }
);

export default function SignIn() {
  const router = useRouter();
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // If already signed in, bounce to home
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data?.session) {
        router.replace("/");
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => {
      if (sess) router.replace("/");
    });
    return () => sub.subscription?.unsubscribe?.();
  }, [router]);

  async function onSubmit(e) {
    e.preventDefault();
    if (busy) return;
    setMsg("");
    setBusy(true);
    try {
      const email = (emailRef.current?.value || "").trim();
      const password = passwordRef.current?.value || "";
      if (!email || !password) {
        setMsg("Please enter your email and password.");
        return;
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMsg(error.message || "Sign-in failed.");
        return;
      }
      if (data?.user) {
        setMsg("Signed in.");
        router.replace("/");
      }
    } catch (err) {
      setMsg(err?.message || "Unexpected error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      id="main"
      tabIndex={-1}
      style={{
        maxWidth: 440,
        margin: "40px auto",
        padding: 24,
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        background: "#ffffff",
      }}
    >
      <h1 style={{ margin: 0, marginBottom: 12, fontSize: 24, fontWeight: 800, textAlign: "left" }}>
        Sign in
      </h1>

      <form onSubmit={onSubmit} autoComplete="on" style={{ textAlign: "left" }}>
        {/* Email */}
        <div style={{ marginBottom: 12 }}>
          <label
            htmlFor="email"
            style={{ display: "block", fontSize: 12, opacity: 0.9, marginBottom: 6, textAlign: "left" }}
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            ref={emailRef}
            // For Chrome/Google Password Manager, "username" works best for login forms
            autoComplete="username"
            inputMode="email"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="you@example.com"
            required
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              textAlign: "left",
            }}
          />
        </div>

        {/* Password */}
        <div style={{ marginBottom: 4 }}>
          <label
            htmlFor="current-password"
            style={{ display: "block", fontSize: 12, opacity: 0.9, marginBottom: 6, textAlign: "left" }}
          >
            Password
          </label>
          <input
            id="current-password"
            name="password"
            type="password"
            ref={passwordRef}
            autoComplete="current-password"
            placeholder="••••••••"
            required
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              textAlign: "left",
            }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
          <button
            type="submit"
            disabled={busy}
            aria-busy={busy ? "true" : "false"}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #0f766e",
              background: "#14b8a6",
              color: "white",
              fontWeight: 700,
              cursor: busy ? "wait" : "pointer",
            }}
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>

          <a
            href="/auth/reset"
            style={{ fontSize: 12, textDecoration: "underline", color: "#334155" }}
            title="Forgot password?"
          >
            Forgot password?
          </a>
        </div>

        {/* Status */}
        <div role="status" aria-live="polite" aria-atomic="true" style={{ marginTop: 10, fontSize: 12, color: "#7f1d1d" }}>
          {msg}
        </div>
      </form>
    </main>
  );
}
