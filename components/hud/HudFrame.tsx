import { cn } from "@/lib/utils";

/**
 * Scene viewport frame: a clean rounded surface with quiet overlay labels.
 * (v2: the sci-fi corner brackets are gone — the scene speaks for itself.)
 */
export function HudFrame({
  children,
  className,
  label,
  sublabel,
  gold = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** Top-left overlay label, e.g. "Bench Press · 225 lb". */
  label?: string;
  /** Bottom-right overlay label, e.g. "2×45 per side". */
  sublabel?: string;
  /** PR mode: labels go gold. */
  gold?: boolean;
}) {
  const labelColor = gold ? "text-forge-gold" : "text-neutral-300";
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-[#0a0a0b]",
        className,
      )}
    >
      {children}
      {label ? (
        <div
          className={cn(
            "pointer-events-none absolute left-4 top-3 text-[13px] font-medium",
            labelColor,
          )}
        >
          {label}
        </div>
      ) : null}
      {sublabel ? (
        <div
          className={cn(
            "pointer-events-none absolute bottom-3 right-4 text-xs font-medium",
            gold ? "text-forge-gold" : "text-neutral-400",
          )}
        >
          {sublabel}
        </div>
      ) : null}
    </div>
  );
}
