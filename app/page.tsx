import type { Metadata } from "next";
import { NexusScreen } from "@/components/screens/NexusScreen";

export const metadata: Metadata = { title: "Liftora — Nexus" };

export default function NexusPage() {
  return <NexusScreen />;
}
