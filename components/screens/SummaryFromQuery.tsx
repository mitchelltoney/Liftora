"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageShell, ScreenHeader } from "@/components/hud/PageShell";
import { SummaryScreen } from "./SummaryScreen";

/**
 * The session id travels as a query param (?id=) instead of a path segment
 * so the whole app can be exported statically (GitHub Pages has no server
 * to resolve dynamic routes).
 */
export function SummaryFromQuery() {
  const id = useSearchParams().get("id");
  if (!id) {
    return (
      <PageShell>
        <ScreenHeader title="Session Debrief" eyebrow="Archive" />
        <div className="glass-panel p-6 text-center">
          <p className="text-sm text-muted-foreground">No session selected.</p>
          <Link
            href="/history"
            className="mt-3 inline-block text-sm text-foreground underline"
          >
            Browse the archive
          </Link>
        </div>
      </PageShell>
    );
  }
  return <SummaryScreen sessionId={id} />;
}
