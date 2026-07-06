import type { Metadata } from "next";
import { AnalyticsScreen } from "@/components/screens/AnalyticsScreen";

export const metadata: Metadata = { title: "Liftora — Analytics" };

export default function AnalyticsPage() {
  return <AnalyticsScreen />;
}
