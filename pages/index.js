import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";
import favicon from "../public/favicon.ico";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const INDEX_BUILD = "idx-36.702";

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setUser(data?.session?.user ?? null);
      setAuthReady(true);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setUser(sess?.user ?? null);
      setAuthReady(true);
    });
    return () => sub.subscription?.unsubscribe?.();
  }, []);

  if (!authReady) return <main aria-busy="true" />;
  if (!user) {
    return (
      <main style={{ padding: 24 }}>
        <h1>The Scope of Morgellons</h1>
        <button onClick={() => router.push("/?auth=1")}>Sign in</button>
      </main>
    );
  }

  const firstName = useMemo(() => {
    const m = user?.user_metadata?.first_name?.trim();
    if (m) return m;
    const email = user?.email || "";
    const local = email.split("@")[0] || "";
    const piece = (local.split(/[._-]/)[0] || local).trim();
    return piece ? piece[0].toUpperCase() + piece.slice(1) : "";
  }, [user]);

  return (
    <main
      data-index-build={INDEX_BUILD}
      style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 20,
        }}
      >
        <h1 style={{ fontSize: 28 }}>
          {firstName
            ? `Welcome to Your Profile, ${firstName}`
            : "Welcome to Your Profile"}
        </h1>
        <div
          style={{
            width: 128,
            height: 128,
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <img
            src={favicon.src}
            alt="Favicon test"
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        </div>
      </header>
    </main>
  );
}
