// Build 36.62_2025-08-23
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/router";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function getQueryParam(name) {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

function parseHashParams() {
  if (typeof window === "undefined") return {};
  const h = window.location.hash?.replace(/^#/, "") || "";
  const p = new URLSearchParams(h);
  return {
    type: p.get("type") || null,
    access_token: p.get("access_token") || null,
    refresh_token: p.get("refresh_token") || null,
  };
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Initializing…");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");

  const hasTokens = useMemo(() => {
    if (typeof window === "undefined") return false;
    const code = getQueryParam("code");
    const hash = parseHashParams();
    return Boolean(code || (hash.access_token && hash.refresh_token));
  }, [router.asPath]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setError("");
      setStatus("Checking your reset link…");

      // Prefer modern query param (?code=) flow
      const code = getQueryParam("code");
      if (code) {
        try {
          const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exErr) throw exErr;
          if (cancelled) return;
          // Clean URL (remove code) to avoid leaking tokens in history
          window.history.replaceState({}, "", "/auth/reset");
          setReady(true);
          setStatus("Enter your new password.");
          return;
        } catch (e) {
          if (cancelled) return;
          setError("We couldn’t verify the reset code. Try the email link again.");
          setStatus("");
          return;
        }
      }

      // Legacy hash token flow (#access_token=…&refresh_token=…&type=recovery)
      const { access_token, refresh_token } = parseHashParams();
      if (access_token && refresh_token) {
        try {
          const { error: setErr } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (setErr) throw setErr;
          if (cancelled) return;
          // Clean URL (remove hash)
          window.history.replaceState({}, "", "/auth/reset");
          setReady(true);
          setStatus("Enter your new password.");
          return;
        } catch (e) {
          if (cancelled) return;
          setError("We couldn’t establish a session from the reset link. Try again.");
          setStatus("");
          return;
        }
      }

      // If no tokens at all
      setStatus("");
      setError("This page must be opened from the password reset email link.");
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [router.asPath]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (pw1.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (pw1 !== pw2) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: updErr } = await supabase.auth.updateUser({ password: pw1 });
      if (updErr) throw updErr;
      // Clear any URL state, then go Home
      window.history.replaceState({}, "", "/auth/reset?done=1");
      setStatus("Password updated. Redirecting…");
      setTimeout(() => router.replace("/"), 400);
    } catch (e) {
      setError(e?.message || "Could not update password.");
      setSubmitting(false);
    }
  }

  return (
    <main id="main" style={{ maxWidth: 520, margin: "40px auto", padding: 16 }}>
      <h1 style={{ marginBottom: 8 }}>Reset your password</h1>
      <p aria-live="polite" style={{ minHeight: 20, marginBottom: 12 }}>
        {status}
      </p>
      {error ? (
        <div role="alert" style={{ marginBottom: 12 }}>{error}</div>
      ) : null}
      {!hasTokens && !ready ? (
        <p>If you need to reset your password, use “Forgot password?” on the sign-in screen.</p>
      ) : null}
      {ready ? (
        <form onSubmit={onSubmit} aria-label="Set new password" style={{ display: "grid", gap: 12 }}>
          <label>
            New password
            <input
              type="password"
              autoComplete="new-password"
              value={pw1}
              onChange={(e) => setPw1(e.target.value)}
              required
              style={{ width: "100%", padding: 8 }}
            />
          </label>
          <label>
            Confirm new password
            <input
              type="password"
              autoComplete="new-password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              required
              style={{ width: "100%", padding: 8 }}
            />
          </label>
          <button type="submit" disabled={submitting} style={{ padding: "10px 14px" }}>
            {submitting ? "Updating…" : "Set new password"}
          </button>
        </form>
      ) : null}
    </main>
  );
}
