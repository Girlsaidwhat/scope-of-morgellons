// Build: 36.10a8_2025-08-19
// Global build tag overlay so every page shows the current build version.

function BuildBadge() {
  const TAG = "36.10a8_2025-08-19";
  const styleWrap = {
    position: "fixed",
    right: 8,
    bottom: 8,
    zIndex: 99999,
    background: "rgba(0,0,0,0.72)",
    color: "#fff",
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 8,
    lineHeight: 1.2,
    userSelect: "none",
  };
  const styleSmall = { opacity: 0.85, display: "block", fontSize: 11 };

  return (
    <div aria-label="Build tag" title="Build tag" style={styleWrap}>
      <span style={styleSmall}>Build</span>
      <strong>{TAG}</strong>
    </div>
  );
}

export default function MyApp({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      <BuildBadge />
    </>
  );
}
