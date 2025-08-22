// components/QuickColors.js
// Build 36.24_2025-08-22
import Link from "next/link";

export default function QuickColors({
  baseHref,
  label,
  colors = [],
  activeColor = "",
  showClear = true,
}) {
  // compact, left-aligned, single-row (wraps as needed)
  const wrap = {
    display: "inline-flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    background: "#111",
    border: "1px solid #000",
    borderRadius: 999,
    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
    padding: "6px 8px",
    color: "#fff",
    margin: "8px 0",
  };

  const titleChip = {
    fontSize: 12,
    fontWeight: 700,
    color: "#fff",
    marginRight: 2,
  };

  const chip = {
    display: "inline-block",
    border: "1px solid #555",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    color: "#fff",
    background: "transparent",
    textDecoration: "none",
    lineHeight: 1,
  };
  const chipActive = {
    ...chip,
    background: "#0b5fff",
    borderColor: "#0b5fff",
    color: "#fff",
  };
  const chipClear = {
    ...chip,
    borderStyle: "dashed",
    borderColor: "#777",
    color: "#ddd",
  };

  return (
    <nav aria-label="Quick colors" style={wrap}>
      <span style={titleChip}>
        {label}{activeColor ? ` · ${activeColor}` : ""}
      </span>

      {showClear && (
        <Link href={baseHref} legacyBehavior>
          <a aria-label="Clear color filter" style={activeColor ? chipClear : chip}>
            Clear color
          </a>
        </Link>
      )}

      {colors.map((c) => {
        const isActive = (activeColor || "")?.toLowerCase() === c.toLowerCase();
        return (
          <Link key={c} href={`${baseHref}?color=${encodeURIComponent(c)}`} legacyBehavior>
            <a
              aria-label={`Filter by color ${c}`}
              aria-current={isActive ? "page" : undefined}
              style={isActive ? chipActive : chip}
            >
              {c}
            </a>
          </Link>
        );
      })}
    </nav>
  );
}

