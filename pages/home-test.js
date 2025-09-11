export default function HomeTest() {
  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 20,
        }}
      >
        <h1 style={{ fontSize: 28, margin: 0 }}>Home Test</h1>
        <div
          style={{
            width: 315,
            height: 429,
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <img
            src="/story_placeholder-idx36704.jpg"
            alt="Fill in your story"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              display: "block",
            }}
          />
        </div>
      </header>
      <p>Route check ok.</p>
    </main>
  );
}
