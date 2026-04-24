"use client";
import dynamic from "next/dynamic";

const SettingsForm = dynamic(() => import("@/components/SettingsForm"), {
  ssr: false,
});

export default function SettingsPage() {
  return <SettingsForm />;
}
