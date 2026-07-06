import type { Metadata } from "next";
import { LoggerScreen } from "@/components/screens/LoggerScreen";

export const metadata: Metadata = { title: "Liftora — Quick Log" };

export default function LogPage() {
  return <LoggerScreen />;
}
