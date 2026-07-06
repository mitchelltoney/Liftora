import type { Metadata } from "next";
import { HistoryScreen } from "@/components/screens/HistoryScreen";

export const metadata: Metadata = { title: "Liftora — History" };

export default function HistoryPage() {
  return <HistoryScreen />;
}
