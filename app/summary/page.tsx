import type { Metadata } from "next";
import { Suspense } from "react";
import { SummaryFromQuery } from "@/components/screens/SummaryFromQuery";

export const metadata: Metadata = { title: "Liftora — Session Debrief" };

export default function SummaryPage() {
  return (
    <Suspense fallback={null}>
      <SummaryFromQuery />
    </Suspense>
  );
}
