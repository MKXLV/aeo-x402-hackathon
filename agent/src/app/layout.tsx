import "./globals.css";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata = {
  title: "AEO Agent",
  description: "Autonomous Company Answer Engine Optimization",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100">
        <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-md bg-gradient-to-br from-cyan-400 to-indigo-500" />
              <div>
                <div className="text-sm font-semibold tracking-tight">AEO Agent</div>
                <div className="text-xs text-slate-400">
                  Autonomous Answer Engine Optimization
                </div>
              </div>
            </div>
            <nav className="flex gap-4 text-sm">
              <Link className="text-slate-300 hover:text-white" href="/">
                Dashboard
              </Link>
              <Link
                className="text-slate-300 hover:text-white"
                href="/settings"
              >
                Settings
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
