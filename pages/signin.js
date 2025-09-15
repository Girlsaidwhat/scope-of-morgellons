// pages/signin.js
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

const SIGNIN_BUILD = "si-1.04";

// Create Supabase client only if env vars are present (runtime)
let supabase = null;
try {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }
} catch {}

export default function SignIn() {
  const router = useRouter();
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // 🔧 Kill any Service Worker so old JS can’t override this page
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations?.().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
    }
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    if (!supabase) {
      setErr("Sign-in not configured: missing Supabase env vars.");
      return;
    }
    const email = emailRef.current?.value?.trim() || "";
    const password = passwordRef.current?.value || "";
    if (!email || !password) {
      setErr("Please enter your email and password.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setErr(error.message || "Sign-in failed.");
        return;
      }
      router.push("/");
    } catch (ex) {
      setErr(ex?.message || "Unexpected error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main data-signin-build={SIGNIN_BUILD} style={{ maxWidth: 420, margin: "40px auto", padding: 16 }}>
      <div id="signin-root">
        <h1 style={{ margin: "0 0 12px" }}>Sign in</h1>

        {err ? (
          <div
            role="alert"
            style={{
              border: "1px solid #fecaca",
              background: "#fee2e2",
              color: "#991b1b",
              borderRadius: 8,
              padding: 10,
              marginBottom: 12,
              fontSize: 14,
            }}
          >
            {err}
          </div>
        ) : null}

        <form onSubmit={onSubmit} autoComplete="on">
          <label htmlFor="email" style={{ display: "block", fontSize: 12, opacity: 0.9, marginBottom: 4 }}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            ref={emailRef}
            required
            style={{
              width: "100%",
              padding: 10,
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              marginBottom: 12,
              fontSize: 14,
            }}
          />

          <label htmlFor="password" style={{ display: "block", fontSize: 12, opacity: 0.9, marginBottom: 4 }}>
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            ref={passwordRef}
            required
            style={{
              width: "100%",
              padding: 10,
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              marginBottom: 12,
              fontSize: 14,
            }}
          />

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              type="submit"
              disabled={busy}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #0f766e",
                background: "#14b8a6",
                color: "#fff",
                fontWeight: 600,
                cursor: busy ? "wait" : "pointer",
                fontSize: 14,
              }}
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>

            <a href="/auth/reset" style={{ fontSize: 12, textDecoration: "underline" }}>
              Forgot password?
            </a>
          </div>
        </form>

        <div style={{ fontSize: 10, opacity: 0.6, marginTop: 10 }}>BUILD: {SIGNIN_BUILD}</div>
      </div>

      {/* Force left alignment on this page only (beats global centering) */}
      <style jsx>{`
        #signin-root,
        #signin-root * {
          text-align: left !important;
        }
      `}</style>
    </main>
  );
}
