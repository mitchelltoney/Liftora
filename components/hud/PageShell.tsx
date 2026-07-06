import { cn } from "@/lib/utils";
import { DockNav } from "./DockNav";

/** Page container: safe-area padding, dock clearance, desktop rail offset. */
export function PageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col md:pl-20">
      <main
        className={cn(
          "mx-auto w-full max-w-2xl flex-1 px-4 pb-28 pt-4 md:max-w-5xl md:px-8 md:pb-10",
          className,
        )}
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
      >
        {children}
      </main>
      <DockNav />
    </div>
  );
}

/** Standard screen header with HUD underline. */
export function ScreenHeader({
  title,
  right,
  eyebrow,
}: {
  title: string;
  right?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <header className="mb-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          {eyebrow ? (
            <div className="hud-label mb-1 text-muted-foreground">{eyebrow}</div>
          ) : null}
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
        </div>
        {right}
      </div>
      <div
        aria-hidden
        className="mt-3 h-px w-full bg-white/10"
      />
    </header>
  );
}
