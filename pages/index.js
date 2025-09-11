import { useEffect, useMemo, useState } from \"react\";
import Link from \"next/link\";
import { useRouter } from \"next/router\";
import { createClient } from \"@supabase/supabase-js\";
import fillInYourStory from \"../public/fill_in_your_story.jpg\";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const INDEX_BUILD = \"idx-36.701\";

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

  if (!authReady) return <main aria-busy=\"true\" />;
  if (!user) {
    return (
      <main style={{ padding: 24 }}>
        <h1>The Scope of Morgellons</h1>
        <p>Landing page content…</p>
        <button onClick={() => router.push(\"/?auth=1\")}>Sign in</button>
      </main>
    );
  }

  const firstName = useMemo(() => {
    const m = user?.user_metadata?.first_name?.trim();
    if (m) return m;
    const email = user?.email || \"\";
    const local = email.split(\"@\")[0] || \"\";
    const piece = (local.split(/[._-]/)[0] || local).trim();
    return piece ? piece[0].toUpperCase() + piece.slice(1) : \"\";
  }, [user]);

  return (
    <main data-index-build={INDEX_BUILD} style={{ padding: 24, maxWidth: 1000, margin: \"0 auto\" }}>
      <header style={{ display: \"flex\", justifyContent: \"space-between\", alignItems: \"flex-start\", gap: 20 }}>
        <h1 style={{ fontSize: 28 }}>
          {firstName ? `Welcome to Your Profile, ${firstName}` : \"Welcome to Your Profile\"}
        </h1>
        <div style={{ width: 315, height: 429, border: \"1px solid #e5e7eb\", borderRadius: 8, overflow: \"hidden\" }}>
          <img
            src={fillInYourStory.src}
            alt=\"Fill in your story\"
            style={{ width: \"100%\", height: \"100%\", objectFit: \"contain\" }}
          />
        </div>
      </header>
    </main>
  );
}
'@ | Set-Content -Encoding UTF8 pages/index.js"
