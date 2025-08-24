// Build 36.64_2025-08-24
import "../styles/globals.css";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const BUILD_TAG = "Build 36.64_2025-08-24";

function BuildBadge() {
  return (
    <div
      aria-label="build badge"
      style={{
        position: "fixed",
        right: 12,
        bottom: 12,
        padding: "6px 10px",
        fontSize: 12,
        borderRadius: 6,
        background: "rgba(0,0,0,0.75)",
        color: "white",
        zIndex: 1000,
        pointerEvents: "none",
      }}
    >
      {BUILD_TAG}
    </div>
  );
}

// Redirect any recovery tokens to /auth/reset BEFORE the app paints,
// preserving query/hash tokens so the reset page can exchange them.
function ResetGate({ children }) {
  const [proceed, setProceed] = useState(false);

  useEffect(() => {
    const { pathname, search, hash } = window.location;

    const query = new URLSearchParams(search);
    const code = query.get("code"); // PKCE-style

    const hashParams = new URLSearchParams((hash || "").replace(/^#/, ""));
    const type = hashParams.get("type"); // "recovery"
    const at = hashParams.get("access_token");
    const rt = hashParams.get("refresh_token");

    const hasRecovery = Boolean(code || type === "recovery" || (at && rt));

    if (hasRecovery && pathname !== "/auth/reset") {
      window.location.replace(`/auth/reset${search}${hash}`);
      return;
    }

    setProceed(true);
  }, []);

  if (!proceed) {
    return (
      <>
        <div
          aria-live="polite"
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          Opening password reset…
        </div>
        <BuildBadge />
      </>
    );
  }

  return (
    <>
      {children}
      <BuildBadge />
    </>
  );
}

// Universal top-right Account control (Sign in / Sign out)
function AccountControl({ session }) {
  const router = useRouter();

  async function handleSignOut() {
    await supabase.auth.signOut();
    // Return to Home after sign-out
    window.location.assign("/");
  }

  if (session?.user) {
    return (
      <div
        style={{
          position: "fixed",
          top: 10,
          right: 12,
          zIndex: 1100,
          display: "flex",
          gap: 8,
          alignItems: "center",
        }}
      >
        <span aria-label="signed in as" style={{ fontSize: 12 }}>
          {session.user.user_metadata?.first_name
            ? `Welcome, ${session.user.user_metadata.first_name}`
            : "Signed in"}
        </span>
        <button
          onClick={handleSignOut}
          aria-label="Sign out"
          style={{ padding: "6px 10px" }}
        >
          Sign out
        </button>
      </div>
    );
  }

  // Logged out
  return (
    <div
      style={{
        position: "fixed",
        top: 10,
        right: 12,
        zIndex: 1100,
        display: "flex",
        gap: 8,
        alignItems: "center",
      }}
    >
      <button
        onClick={() => {
          if (router.pathname !== "/") window.location.assign("/");
          // The AuthOverlay will appear automatically on "/"
          // (no-op if already on "/")
        }}
        aria-label="Go to sign in"
        style={{ padding: "6px 10px" }}
      >
        Sign in
      </button>
    </div>
  );
}

// Shows a real Sign in + Forgot password form on "/" when logged out
function AuthOverlay({ show }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [status, setStatus] = useState("");
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);

  if (!show) return null;

  async function doPasswordSignIn(e) {
    e.preventDefault();
    setErr("");
    setStatus("Signing in…");
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: pw,
      });
      if (error) throw error;
      setStatus("Signed in. Loading your Home…");
      window.location.assign("/"); // show Welcome + gallery
    } catch (e) {
      setStatus("");
      setErr(e?.message || "Could not sign in.");
    }
  }

  async function doMagicLink(e) {
    e.preventDefault();
    setErr("");
    setSending(true);
    setStatus("Sending magic link…");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;
      setStatus("Check your email for the sign-in link.");
    } catch (e) {
      setErr(e?.message || "Could not send magic link.");
    } finally {
      setSending(false);
    }
  }

  async function doForgotPassword(e) {
    e.preventDefault();
    setErr("");
    setSending(true);
    setStatus("Sending reset email…");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset`,
      });
      if (error) throw error;
      setStatus("Check your email for the reset link.");
    } catch (e) {
      setErr(e?.message || "Could not send reset email.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-label="Sign in"
      style={{
        position: "fixed",
        inset: 0,
        background: "white",
        zIndex: 1050,
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          padding: 16,
          border: "1px solid #ddd",
          borderRadius: 10,
          boxShadow: "0 6px 20px rgba(0,0,0,0.08)",
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: 8 }}>Welcome to The Scope of Morgellons</h1>
        <p style={{ marginTop: 0, marginBottom: 16 }}>
          Sign in or request a magic link. You can also reset your password.
        </p>

        <form onSubmit={doPasswordSignIn} style={{ display: "grid", gap: 10 }}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: "100%", padding: 8 }}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoComplete="current-password"
              required
              style={{ width: "100%", padding: 8 }}
            />
          </label>
          <button type="submit" style={{ padding: "10px 14px" }}>
            Sign in
          </button>
          <button onClick={doMagicLink} disabled={sending} style={{ padding: "8px 12px" }}>
            {sending ? "Sending…" : "Send magic link"}
          </button>
          <button onClick={doForgotPassword} disabled={sending} style={{ padding: "8px 12px" }}>
            {sending ? "Sending…" : "Forgot password?"}
          </button>
        </form>

        <p aria-live="polite" style={{ minHeight: 18, marginTop: 12 }}>{status}</p>
        {err ? (
          <div role="alert" style={{ color: "#b00020", marginTop: 6 }}>{err}</div>
        ) : null}
      </div>
    </div>
  );
}

export default function MyApp({ Component, pageProps }) {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    document.querySelectorAll("[data-build-line]").forEach((el) => el.remove());
  }, []);

  // Keep session in sync and gate initial render so we avoid flicker
  useEffect(() => {
    let unsub = () => {};
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session || null);
      setChecked(true);
      const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
        setSession(s || null);
      });
      unsub = sub.subscription?.unsubscribe || (() => {});
    })();
    return () => unsub();
  }, []);

  // While we don’t know the session yet, show nothing (prevents Home flicker)
  if (!checked) {
    return (
      <>
        <div
          aria-live="polite"
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          Loading…
        </div>
        <BuildBadge />
      </>
    );
  }

  const showAuthOverlay = !session && router.pathname === "/";

  return (
    <>
      <a
        href="#main"
        style={{
          position: "absolute",
          left: -9999,
          top: "auto",
          width: 1,
          height: 1,
          overflow: "hidden",
        }}
        onFocus={(e) => {
          e.currentTarget.style.left = "8px";
          e.currentTarget.style.top = "8px";
          e.currentTarget.style.width = "auto";
          e.currentTarget.style.height = "auto";
          e.currentTarget.style.padding = "6px 8px";
          e.currentTarget.style.background = "white";
          e.currentTarget.style.border = "1px solid #ccc";
        }}
        onBlur={(e) => {
          e.currentTarget.style.left = "-9999px";
          e.currentTarget.style.top = "auto";
          e.currentTarget.style.width = "1px";
          e.currentTarget.style.height = "1px";
          e.currentTarget.style.padding = "0";
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.border = "none";
        }}
      >
        Skip to main content
      </a>

      <ResetGate>
        <AccountControl session={session} />
        <Component {...pageProps} />
        <AuthOverlay show={showAuthOverlay} />
      </ResetGate>
    </>
  );
}
