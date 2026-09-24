import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";

export const metadata: Metadata = {
  title: "InfraSync-AI",
  description: "From field updates to verified schedule actuals.",
  applicationName: "InfraSync-AI"
};

export const viewport: Viewport = {
  themeColor: "#0F2A4A"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-navy-900 antialiased">
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
