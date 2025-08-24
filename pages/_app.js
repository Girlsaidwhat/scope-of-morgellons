// pages/_app.js
// Build 36.53_2025-08-23
import "../styles/globals.css";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

export const BUILD_VERSION = "Build 36.53_2025-08-23";

const supabase =
  typeof window !== "undefined"
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      )
    : null;

function BuildBadge() {
  const badgeStyle = {
    position: "fixed",
    right: 8,
    bottom: 8,
    zIndex: 9999,
    fontSize: 12,
    padding: "4px 10px",
    borderRadius: 8,
    color: "#fff",
    background: "#111",
    border: "1px solid #000",
    boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
  };
  return (
    <div aria-label="Build version" style={badgeStyle}>
      {BUILD_VERSION}
    </div>
  );
}

function useAuthPresence() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!supabase) return;
      const { data } = await supabase.auth.getUser();
      if (mounted) setSignedIn(!!data?.user);
    })();
    const { data: sub } =
      supabase?.auth.onAuthStateChange?.((_event, session) => {
        setSignedIn(!!session?.user);
      }) || { data: null };
    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);
  return signedIn;
}

/** Top-right Account control, visible on every page */
function AccountButton() {
  const signedIn = useAuthPresence();
  const [busy, setBusy] = useState(false);

  const baseBtn = {
    position: "fixed",
    right: 8,
    top: 8,
    zIndex: 10000,
    fontSize: 12,
    padding: "4px 8px",
    borderRadius: 6,
    background: "#fff",
    border: "1px solid #ccc",
    color: "#111",
    boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
    cursor: "pointer",
  };

  if (!signedIn) {
    return (
      <a href="/" aria-label="Go to sign in" style={{ ...baseBtn, textDecoration: "none" }}>
        Sign in
      </a>
    );
  }

  async function handleSignOut() {
    if (busy || !supabase) return;
    setBusy(true);
    try {
      await supabase.auth.signOut();
    } finally {
      window.location.href = "/";
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      aria-label="Sign out"
      disabled={busy}
      style={{ ...baseBtn, cursor: busy ? "not-allowed" : "pointer" }}
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}

/** Home auth screen: Email+Password Sign in / Sign up, Forgot password, Magic link, and “?” password tips */
function HomeAuthScreen() {
  const [mode, setMode] = useState("signin"); // 'signin' | 'signup' | 'reset'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [showPwHelp, setShowPwHelp] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");

  useEffect(() => {
    const sub = supabase?.auth.onAuthStateChange?.((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("reset");
        setMsg("Enter a new password to finish resetting.");
      }
    });
    try {
      const url = new URL(window.location.href);
      if ((url.searchParams.get("type") || "").toLowerCase() === "recovery") {
        setMode("reset");
        setMsg("Enter a new password to finish resetting.");
      }
    } catch {}
    return () => sub?.data?.subscription?.unsubscribe?.();
  }, []);

  const page = { maxWidth: 520, margin: "0 auto", padding: "24px 16px" };
  const h1 = { fontSize: 22, fontWeight: 700, margin: "0 0 32px" };
  const p = { fontSize: 14, color: "#444", margin: "0 0 16px" };
  const tabs = { display: "flex", gap: 8, marginBottom: 16 };
  const tab = (active) => ({
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid " + (active ? "#111" : "#ddd"),
    background: active ? "#111" : "#fff",
    color: active ? "#fff" : "#111",
    cursor: "pointer",
    fontSize: 13,
  });
  const formRow = { display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" };
  const label = { fontSize: 12, fontWeight: 700, minWidth: 80 };
  const input = { flex: "1 1 280px", padding: "10px 12px", border: "1px solid #ccc", borderRadius: 8, fontSize: 14 };
  const btn = { padding: "10px 14px", border: "1px solid #111", borderRadius: 8, background: "#111", color: "#fff", cursor: "pointer", fontSize: 14 };
  const ghost = { padding: "8px 12px", border: "1px solid #ccc", borderRadius: 8, background: "#fff", color: "#111", fontSize: 13, cursor: "pointer" };
  const linkBtn = { padding: "6px 10px", border: "1px solid #ddd", borderRadius: 6, background: "#fff", color: "#111", fontSize: 12, cursor: "pointer" };
  const fine = { fontSize: 12, color: "#555" };
  const statusStyle = { fontSize: 13, color: "#555", marginTop: 10 };

  function pwPolicyOk(pw) {
    return typeof pw === "string" && pw.length >= 12;
  }

  async function handleSignIn(e) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMsg("Signing in…");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMsg(error.message || "Sign-in failed. Check your email or password.");
      } else {
        setMsg("");
      }
    } catch {
      setMsg("Sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignUp(e) {
    e.preventDefault();
    if (!supabase) return;
    if (!pwPolicyOk(password)) {
      setMsg("Please use at least 12 characters. Spaces are allowed; symbols are optional.");
      return;
    }
    setBusy(true);
    setMsg("Creating your account…");
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });
      if (error) {
        setMsg(error.message || "Sign-up failed. Please try again.");
      } else {
        setMsg("Check your email to verify your address, then sign in.");
      }
    } catch {
      setMsg("Sign-up failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleMagicLink() {
    if (!supabase) return;
    if (!email) {
      setMsg("Enter your email first, then choose the email sign-in link.");
      return;
    }
    setBusy(true);
    setMsg("Sending sign-in link…");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });
      if (error) {
        setMsg(error.message || "Could not send the link. Please try again.");
      } else {
        setMsg("Check your email for a one-time sign-in link.");
      }
    } catch {
      setMsg("Could not send the link. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleForgotPw() {
    if (!supabase) return;
    if (!email) {
      setMsg("Enter your email above, then choose Forgot password.");
      return;
    }
    setBusy(true);
    setMsg("Sending password reset email…");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: typeof window !== "undefined" ? `${window.location.origin}?type=recovery` : undefined,
      });
      if (error) {
        setMsg(error.message || "Could not send reset email.");
      } else {
        setMsg("Check your email for the reset link, then set a new password here.");
      }
    } catch {
      setMsg("Could not send reset email.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDoReset(e) {
    e.preventDefault();
    if (!supabase) return;
    if (!pwPolicyOk(newPw) || newPw !== newPw2) {
      setMsg(newPw !== newPw2 ? "Passwords don’t match." : "Use at least 12 characters.");
      return;
    }
    setBusy(true);
    setMsg("Updating your password…");
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) {
        setMsg(error.message || "Could not update password.");
      } else {
        setMsg("Password updated. You can now sign in.");
        setMode("signin");
        setPassword("");
      }
    } catch {
      setMsg("Could not update password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main" style={page} data-auth-ui="v2">
      {mode !== "reset" ? (
        <>
          <h1 style={h1}>Welcome to The Scope of Morgellons</h1>
          <p style={p}>Use 12+ characters. Spaces are allowed. Symbols are optional.</p>

          <div style={tabs} role="tablist" aria-label="Authentication mode">
            <button
              role="tab"
              aria-selected={mode === "signin" ? "true" : "false"}
              style={tab(mode === "signin")}
              onClick={() => setMode("signin")}
              disabled={busy}
            >
              Sign in
            </button>
            <button
              role="tab"
              aria-selected={mode === "signup" ? "true" : "false"}
              style={tab(mode === "signup")}
              onClick={() => setMode("signup")}
              disabled={busy}
            >
              Sign up
            </button>
          </div>

          <div style={formRow}>
            <label htmlFor="email" style={label}>Email</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={input}
            />
          </div>

          <div style={{ ...formRow, alignItems: "flex-start" }}>
            <label htmlFor="password" style={label}>Password</label>
            <div style={{ flex: "1 1 280px" }}>
              <input
                id="password"
                name="password"
                type="password"
                required={mode === "signup" || mode === "signin"}
                placeholder={mode === "signup" ? "Create a password (12+ chars)" : "Your password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ ...input, width: "100%" }}
              />
              <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => setShowPwHelp((s) => !s)}
                  aria-expanded={showPwHelp ? "true" : "false"}
                  aria-controls="pw-help"
                  style={linkBtn}
                >
                  ?
                </button>
                <span style={fine}>Tip: 12+ characters. Spaces allowed. Symbols optional.</span>
              </div>
              {showPwHelp && (
                <div
                  id="pw-help"
                  role="region"
                  aria-label="Password tips (modern guidance)"
                  style={{
                    marginTop: 8,
                    padding: "10px 12px",
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    background: "#fafafa",
                    fontSize: 13,
                    lineHeight: 1.35,
                  }}
                >
                  <strong>Password tips (modern guidance)</strong>
                  <ul style={{ margin: "8px 0 0 18px", padding: 0 }}>
                    <li>Longer is stronger: 12+ characters (16 is better).</li>
                    <li>Passphrases work: spaces are allowed (e.g., <code>river moss cello planet</code>).</li>
                    <li>Symbols are optional; length + unpredictability matter more.</li>
                    <li>Use a unique password here; a password manager helps.</li>
                    <li>Forgot it? Use <em>Forgot password</em>. Prefer not to type it? Use the email sign-in link.</li>
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
            {mode === "signin" ? (
              <>
                <button onClick={handleSignIn} disabled={busy} style={btn} aria-busy={busy ? "true" : "false"}>
                  {busy ? "Working…" : "Sign in"}
                </button>
                <button onClick={handleForgotPw} disabled={busy} style={ghost}>
                  Forgot password?
                </button>
                <button onClick={handleMagicLink} disabled={busy} style={ghost} title="Email me a one-time link">
                  Email me a sign-in link
                </button>
              </>
            ) : (
              <>
                <button onClick={handleSignUp} disabled={busy} style={btn} aria-busy={busy ? "true" : "false"}>
                  {busy ? "Working…" : "Create account"}
                </button>
                <span style={fine}>We’ll ask you to verify your email after sign-up.</span>
              </>
            )}
          </div>

          <p aria-live="polite" style={statusStyle}>{msg}</p>
        </>
      ) : (
        <>
          <h1 style={h1}>Reset your password</h1>
          <p style={p}>Create a new password (12+ characters). Spaces are allowed.</p>

          <form onSubmit={handleDoReset} aria-label="Reset password form">
            <div style={formRow}>
              <label htmlFor="newPw" style={label}>New password</label>
              <input
                id="newPw"
                name="newPw"
                type="password"
                required
                placeholder="New password (12+ chars)"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                style={input}
              />
            </div>
            <div style={formRow}>
              <label htmlFor="newPw2" style={label}>Confirm</label>
              <input
                id="newPw2"
                name="newPw2"
                type="password"
                required
                placeholder="Repeat new password"
                value={newPw2}
                onChange={(e) => setNewPw2(e.target.value)}
                style={input}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" disabled={busy} style={btn} aria-busy={busy ? "true" : "false"}>
                {busy ? "Updating…" : "Update password"}
              </button>
              <button type="button" onClick={() => setMode("signin")} disabled={busy} style={ghost}>
                Cancel
              </button>
            </div>
          </form>

          <p aria-live="polite" style={statusStyle}>{msg}</p>
        </>
      )}
    </main>
  );
}

export default function MyApp({ Component, pageProps }) {
  const router = useRouter();
  const signedIn = useAuthPresence();
  const showAuthOnHome = router.pathname === "/" && !signedIn;

  // Visually hidden skip link for a11y
  const srOnly = {
    position: "absolute",
    left: "-10000px",
    top: "auto",
    width: "1px",
    height: "1px",
    overflow: "hidden",
  };
  const srOnlyFocus = {
    position: "static",
    width: "auto",
    height: "auto",
    overflow: "visible",
    padding: "4px 8px",
    border: "1px solid #ccc",
    borderRadius: 6,
    background: "#fff",
    margin: 8,
    display: "inline-block",
  };

  function handleSkipFocus(e) {
    e.currentTarget.setAttribute(
      "style",
      Object.entries(srOnlyFocus).map(([k, v]) => `${k}:${v}`).join(";")
    );
  }
  function handleSkipBlur(e) {
    e.currentTarget.setAttribute(
      "style",
      Object.entries(srOnly).map(([k, v]) => `${k}:${v}`).join(";")
    );
  }

  return (
    <>
      <a href="#main" onFocus={handleSkipFocus} onBlur={handleSkipBlur} style={srOnly}>
        Skip to content
      </a>

      {showAuthOnHome ? <HomeAuthScreen /> : <Component {...pageProps} />}

      <AccountButton />
      <BuildBadge />
    </>
  );
}





























