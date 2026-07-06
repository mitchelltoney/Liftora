import type { Metadata } from "next";
import { SettingsScreen } from "@/components/screens/SettingsScreen";

export const metadata: Metadata = { title: "Liftora — Settings" };

export default function SettingsPage() {
  return <SettingsScreen />;
}
