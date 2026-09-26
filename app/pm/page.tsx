"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { PmShell } from "@/components/PmShell";
import {
  FolderPlus,
  ArrowRight,
  ClipboardCheck,
  Search,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
  BarChart2,
} from "lucide-react";
import { formatDate, formatPct } from "@/lib/utils";

interface ProjectRow {
  projectId: string;
  projectName: string;
  createdAt: string;
  totalActivities: number;
  overallProgressPct: number;
  completedActivities: number;
  inProgressActivities: number;
  delayedActivities: number;
  pendingAiAuditReviews: number;
}

type SortKey = "date" | "name" | "progress" | "delayed";

function StatusBar({ pct }: { pct: number }) {
  const color =
    pct >= 70 ? "bg-teal-500" : pct >= 30 ? "bg-amber-400" : "bg-rose-400";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function WorkingProjectsPage() {
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("date");

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects))
      .catch(() => setError("Could not load projects. Check your database connection."));
  }, []);

  const stats = useMemo(() => {
    if (!projects) return null;
    return {
      total: projects.length,
      delayed: projects.filter((p) => p.delayedActivities > 0).length,
      avgProgress: projects.length
        ? Math.round(projects.reduce((s, p) => s + p.overallProgressPct, 0) / projects.length)
        : 0,
      pendingAudits: projects.reduce((s, p) => s + p.pendingAiAuditReviews, 0),
    };
  }, [projects]);

  const filtered = useMemo(() => {
    if (!projects) return [];
    let list = projects.filter((p) =>
      p.projectName.toLowerCase().includes(search.toLowerCase()) ||
      p.projectId.toLowerCase().includes(search.toLowerCase())
    );
    if (sort === "date") list = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (sort === "name") list = [...list].sort((a, b) => a.projectName.localeCompare(b.projectName));
    if (sort === "progress") list = [...list].sort((a, b) => b.overallProgressPct - a.overallProgressPct);
    if (sort === "delayed") list = [...list].sort((a, b) => b.delayedActivities - a.delayedActivities);
    return list;
  }, [projects, search, sort]);

  return (
    <PmShell>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-navy-900">Working Projects</h1>
          <p className="mt-0.5 text-sm text-slate-400">All projects tracked in InfraSync-AI.</p>
        </div>
        <Link href="/pm/new-project" className="btn-primary">
          <FolderPlus size={15} />
          New Project
        </Link>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 card border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
          {error}
        </div>
      )}

      {/* Loading */}
      {!error && projects === null && (
        <div className="card p-10 text-center text-sm text-slate-400">Loading projects…</div>
      )}

      {projects !== null && (
        <>
          {/* Stats Bar */}
          {stats && (
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="card flex items-center gap-3 px-4 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-50">
                  <BarChart2 size={15} className="text-navy-700" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Total Projects</p>
                  <p className="text-lg font-semibold text-navy-900">{stats.total}</p>
                </div>
              </div>
              <div className="card flex items-center gap-3 px-4 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50">
                  <CheckCircle2 size={15} className="text-teal-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Avg Progress</p>
                  <p className="text-lg font-semibold text-navy-900">{stats.avgProgress}%</p>
                </div>
              </div>
              <div className="card flex items-center gap-3 px-4 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50">
                  <AlertTriangle size={15} className="text-rose-500" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">With Delays</p>
                  <p className="text-lg font-semibold text-navy-900">{stats.delayed}</p>
                </div>
              </div>
              <div className="card flex items-center gap-3 px-4 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
                  <Clock size={15} className="text-amber-500" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Pending Audits</p>
                  <p className="text-lg font-semibold text-navy-900">{stats.pendingAudits}</p>
                </div>
              </div>
            </div>
          )}

          {/* Search + Sort */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search projects…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field pl-8 text-sm"
              />
            </div>
            <div className="relative">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="appearance-none input-field pr-8 text-sm cursor-pointer"
              >
                <option value="date">Sort: Latest</option>
                <option value="name">Sort: Name</option>
                <option value="progress">Sort: Progress</option>
                <option value="delayed">Sort: Most Delayed</option>
              </select>
              <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          {/* Empty state */}
          {filtered.length === 0 && (
            <div className="card flex flex-col items-center gap-3 p-14 text-center">
              <FolderPlus size={26} className="text-slate-300" />
              <p className="text-sm text-slate-500">
                {search ? `No projects match "${search}"` : "No projects yet. Start by importing a baseline schedule."}
              </p>
              {!search && (
                <Link href="/pm/new-project" className="btn-primary mt-1">
                  Start New Project
                </Link>
              )}
            </div>
          )}

          {/* Project List */}
          {filtered.length > 0 && (
            <div className="card overflow-hidden">
              {/* Table header */}
              <div className="hidden grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 border-b border-slate-100 bg-slate-50 px-5 py-2.5 text-xs font-medium uppercase tracking-wider text-slate-400 sm:grid">
                <span>Project</span>
                <span>Progress</span>
                <span>Activities</span>
                <span>Status</span>
                <span />
              </div>

              <div className="divide-y divide-slate-100">
                {filtered.map((p) => (
                  <div
                    key={p.projectId}
                    className="grid grid-cols-1 gap-3 px-5 py-4 transition hover:bg-slate-50 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-center sm:gap-4"
                  >
                    {/* Project name */}
                    <div className="min-w-0">
                      <p className="truncate font-medium text-navy-900 text-sm">{p.projectName}</p>
                      <p className="mt-0.5 font-mono text-xs text-slate-400">{p.projectId} · {formatDate(p.createdAt)}</p>
                    </div>

                    {/* Progress */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <StatusBar pct={p.overallProgressPct} />
                      </div>
                      <span className="w-10 text-right text-xs font-medium text-slate-600">
                        {formatPct(p.overallProgressPct)}
                      </span>
                    </div>

                    {/* Activities */}
                    <div className="flex gap-3 text-xs text-slate-500">
                      <span className="text-teal-600 font-medium">{p.completedActivities} done</span>
                      <span>{p.inProgressActivities} active</span>
                      {p.delayedActivities > 0 && (
                        <span className="text-rose-500 font-medium">{p.delayedActivities} delayed</span>
                      )}
                    </div>

                    {/* Badges */}
                    <div className="flex flex-wrap gap-1.5">
                      {p.delayedActivities > 0 && (
                        <span className="chip chip-danger">{p.delayedActivities} delayed</span>
                      )}
                      {p.pendingAiAuditReviews > 0 && (
                        <span className="chip chip-amber">{p.pendingAiAuditReviews} audit</span>
                      )}
                      {p.delayedActivities === 0 && p.pendingAiAuditReviews === 0 && (
                        <span className="chip chip-teal">On track</span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Link
                        href={`/pm/projects/${p.projectId}/dashboard`}
                        className="btn-primary px-3 py-2 text-xs"
                      >
                        Dashboard
                        <ArrowRight size={13} />
                      </Link>
                      <Link
                        href={`/pm/audit-queue?projectId=${p.projectId}`}
                        className="btn-secondary px-3 py-2 text-xs"
                      >
                        <ClipboardCheck size={13} />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer count */}
              <div className="border-t border-slate-100 bg-slate-50 px-5 py-2.5 text-xs text-slate-400">
                Showing {filtered.length} of {projects.length} projects
              </div>
            </div>
          )}
        </>
      )}
    </PmShell>
  );
}
