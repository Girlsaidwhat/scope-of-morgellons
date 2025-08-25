// Build 36.67_2025-08-24
import "../styles/globals.css";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const BUILD_TAG = "Build 36.67_2025-08-24";

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

// Minimal gate: if the URL contains recovery tokens, jump to /auth/reset BEFORE anything paints.
function ResetGate({ children }) {
  const [proceed, setProceed] = useState(false);

  useEffect(() => {
    const { pathname, search, hash } = window.location;

    // Query params
    const qs = new URLSearchParams(search);
    const code = qs.get("code");
    const qType = (qs.get("type") || "").toLowerCase();
    const qToken = qs.get("token") || qs.get("recovery_token");

    // Hash params
    const hs = new URLSearchParams((hash || "").replace(/^#/, ""));
    const hType = (hs.get("type") || "").toLowerCase(); // "recovery"
    const at = hs.get("access_token");
    const rt = hs.get("refresh_token");

    const hasRecovery =
      !!code || (qType === "recovery" && !!qToken) || hType === "recovery" || (at && rt);

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

// Small helper shown ONLY when logged out on "/" — adds Forgot password + "?" tips
function LoggedOutAssist() {
  const [session, setSession] = useState(null);
  const [checked, setChecked] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session || null);
      setChecked(true);
      const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s || null));
      unsub = sub.subscription?.unsubscribe || (() => {});
    })();
    return () => unsub();
  }, []);

  if (!checked) return null;
  const onHome = typeof window !== "undefined" && window.location.pathname === "/";
  const show = !session && onHome;
  if (!show) return null;

  async function sendReset(e) {
    e.preventDefault();
    setErr("");
    setStatus("Sending reset email…");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset`,
      });
      if (error) throw error;
      setStatus("Check your email for the reset link.");
    } catch (e2) {
      setErr(e2?.message || "Could not send reset email.");
    }
  }

  return (
    <>
      {/* Top-right tiny controls */}
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
          aria-label="Forgot password?"
          style={{ padding: "6px 10px" }}
          onClick={() => {
            setShowReset((v) => !v);
            setShowTips(false);
            setStatus("");
            setErr("");
          }}
        >
          Forgot password?
        </button>
        <button
          aria-label="Password tips"
          style={{ padding: "6px 10px" }}
          onClick={() => {
            setShowTips((v) => !v);
            setShowReset(false);
          }}
        >
          ?
        </button>
      </div>

      {/* Small panel for reset */}
      {showReset ? (
        <div
          role="dialog"
          aria-label="Reset password"
          style={{
            position: "fixed",
            top: 48,
            right: 12,
            zIndex: 1100,
            width: 320,
            border: "1px solid #ddd",
            borderRadius: 10,
            background: "white",
            boxShadow: "0 6px 20px rgba(0,0,0,0.08)",
            padding: 12,
          }}
        >
          <form onSubmit={sendReset} style={{ display: "grid", gap: 8 }}>
            <label>
              Email for reset link
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ width: "100%", padding: 8, marginTop: 4 }}
              />
            </label>
            <button type="submit" style={{ padding: "8px 12px" }}>Send reset email</button>
          </form>
          <p aria-live="polite" style={{ minHeight: 18, marginTop: 8 }}>{status}</p>
          {err ? <div role="alert" style={{ color: "#b00020" }}>{err}</div> : null}
        </div>
      ) : null}

      {/* Small panel for password tips */}
      {showTips ? (
        <div
          role="dialog"
          aria-label="Password guidelines"
          style={{
            position: "fixed",
            top: 48,
            right: 12,
            zIndex: 1100,
            width: 320,
            border: "1px solid #ddd",
            borderRadius: 10,
            background: "white",
            boxShadow: "0 6px 20px rgba(0,0,0,0.08)",
            padding: 12,
          }}
        >
          <strong style={{ display: "block", marginBottom: 6 }}>Password tips</strong>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>Use 12+ characters.</li>
            <li>Mix upper and lower case, numbers, and a symbol.</li>
            <li>Avoid names, birthdays, or common words.</li>
            <li>Do not reuse a password from another site.</li>
          </ul>
        </div>
      ) : null}
    </>
  );
}

export default function MyApp({ Component, pageProps }) {
  useEffect(() => {
    // Remove any per-page build lines post-hydration
    document.querySelectorAll("[data-build-line]").forEach((el) => el.remove());
  }, []);

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
        <Component {...pageProps} />
        <LoggedOutAssist />
      </ResetGate>
    </>
  );
}
