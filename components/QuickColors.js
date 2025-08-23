// components/QuickColors.js
// Build 36.32_2025-08-23
import Link from "next/link";
import { useState } from "react";

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

  // Minimal inline group (no big container)
  const wrap = {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    margin: "6px 0 10px",
  };

  const title = {
    fontSize: 12,
    fontWeight: 700,
    color: "#333",
    marginRight: 2,
    lineHeight: 1,
  };

  // Compact chips: softer gray, tighter padding
  const chipBase = {
    display: "inline-block",
    border: "1px solid #cfcfcf",
    borderRadius: 999,
    padding: "5px 9px",
    fontSize: 12,
    lineHeight: 1,
    textDecoration: "none",
    transition: "transform 80ms ease, box-shadow 80ms ease",
    outline: "none",
  };
  const chip = {
    ...chipBase,
    color: "#111",
    background: "#dedede",
  };
  const chipActive = {
    ...chipBase,
    color: "#fff",
    background: "#111",
    borderColor: "#111",
  };
  const chipHover = {
    transform: "translateY(-1px)",
    boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
  };
  const chipFocus = {
    boxShadow: "0 0 0 2px rgba(11,95,255,0.5)",
  };

  function Chip({ href, label, active }) {
    const [hover, setHover] = useState(false);
    const [focus, setFocus] = useState(false);
    const style = {
      ...(active ? chipActive : chip),
      ...(hover ? chipHover : null),
      ...(focus ? chipFocus : null),
    };
    return (
      <Link href={href} legacyBehavior>
        <a
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          aria-label={`Filter by color ${label}`}
          aria-current={active ? "page" : undefined}
          style={style}
        >
          {label}
        </a>
      </Link>
    );
  }

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
          <Chip key={item.value} href={href} label={item.label} active={isActive} />
        );
      })}
    </nav>
  );
}







