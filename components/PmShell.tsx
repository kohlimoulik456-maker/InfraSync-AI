"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, FolderPlus, ClipboardCheck, BookOpen, UserCircle2, PlayCircle, HardHat } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/pm", label: "Working Projects", icon: LayoutGrid },
  { href: "/pm/new-project", label: "Start New Project", icon: FolderPlus },
  { href: "/pm/audit-queue", label: "AI Audit Queue", icon: ClipboardCheck },
  { href: "/pm/institutional-memory", label: "Institutional Memory", icon: BookOpen },
  { href: "/pm/demo-center", label: "Demo Center", icon: PlayCircle }
];

export function PmShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-100 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-navy-700 text-sm font-bold text-white">
              IS
            </div>
            <span className="text-base font-semibold text-navy-900">InfraSync-AI</span>
          </Link>
          <div className="flex items-center gap-3 text-xs text-slate-500 sm:gap-4 sm:text-sm">
            <Link href="/supervisor" title="Open Supervisor View" className="flex items-center gap-1.5 whitespace-nowrap hover:text-navy-700">
              <HardHat size={16} />
              <span className="hidden sm:inline">Supervisor View</span>
            </Link>
            <UserCircle2 size={20} />
            <span className="hidden sm:inline">Program Manager (Demo)</span>
          </div>
        </div>
        <nav className="overflow-x-auto">
          <div className="mx-auto flex min-w-max max-w-7xl gap-1 px-4 sm:px-6">
          {NAV.map((item) => {
            const active = pathname === item.href || (item.href !== "/pm" && pathname.startsWith(`${item.href}/`));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition",
                  active
                    ? "border-navy-700 text-navy-900"
                    : "border-transparent text-slate-500 hover:text-navy-700"
                )}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
