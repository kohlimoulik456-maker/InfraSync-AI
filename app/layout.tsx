import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "InfraSync-AI",
  description: "From field updates to verified schedule actuals."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-navy-900 antialiased">{children}</body>
    </html>
  );
}
