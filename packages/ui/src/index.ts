import React from "react";

export function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" }
) {
  const { className = "", variant = "primary", ...rest } = props;
  const base = "px-4 py-2 rounded font-medium transition-colors";
  const styles =
    variant === "primary"
      ? "bg-black text-white hover:bg-neutral-800"
      : "bg-white text-black border border-neutral-200 hover:bg-neutral-100";
  return React.createElement("button", { className: `${base} ${styles} ${className}`, ...rest });
}
