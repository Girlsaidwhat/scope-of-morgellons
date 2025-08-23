// components/QuickColors.js
// Build 36.31_2025-08-23
import Link from "next/link";

export default function QuickColors({
  baseHref,
  label = "Colors",
  colors = [],           // accepts ["Red", ...] or [{ label, value }]
  activeColor = "",      // current value from ?color=...
}) {
  const items = (colors || []).map((c) =>
    typeof c === "string" ? { label: c, value: c } : c
  );
  const active = (activeColor || "").toLowerCase();
  const activeItem =
    items.find((i) => (i.value || "").toLowerCase() === active) || null;

  // Minimal inline group (no big container pill)
  const wrap = {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    margin: "6px 0 10px",
  };

  const title = {
    fontSize: 12,
    fontWeight: 700,
    color: "#333",
    marginRight: 2,
    lineHeight: 1,
  };

  // Compact chips
  const chip = {
    display: "inline-block",
    border: "1px solid #c8c8c8",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    color: "#111",
    background: "#e9e9e9",
    textDecoration: "none",
    lineHeight: 1,
  };
  const chipActive = {
    ...chip,
    background: "#111",
    borderColor: "#111",
    color: "#fff",
  };

  return (
    <nav aria-label="Quick colors" style={wrap}>
      <span style={title}>
        {label}
        {activeItem ? ` · ${activeItem.label}` : ""}
      </span>

      {items.map((item) => {
        const isActive = (item.value || "").toLowerCase() === active;
        const href = `${baseHref}?color=${encodeURIComponent(item.value)}`;
        return (
          <Link key={item.value} href={href} legacyBehavior>
            <a
              aria-label={`Filter by color ${item.label}`}
              aria-current={isActive ? "page" : undefined}
              style={isActive ? chipActive : chip}
            >
              {item.label}
            </a>
          </Link>
        );
      })}
    </nav>
  );
}






