"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PmShell } from "@/components/PmShell";
import { FolderPlus, ArrowRight, ClipboardCheck } from "lucide-react";
import { formatDate, formatPct } from "@/lib/utils";
import { StatusChip } from "@/components/StatusChip";

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

export default function WorkingProjectsPage() {
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects))
      .catch(() => setError("Could not load projects. Check your database connection."));
  }, []);

  return (
    <PmShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">Working Projects</h1>
          <p className="mt-1 text-sm text-slate-500">All projects currently tracked in InfraSync-AI.</p>
        </div>
        <Link href="/pm/new-project" className="btn-primary">
          <FolderPlus size={16} />
          Start New Project
        </Link>
      </div>

      {error && <div className="card border-danger-500/30 bg-danger-50 p-4 text-sm text-danger-500">{error}</div>}

      {!error && projects === null && (
        <div className="card p-10 text-center text-sm text-slate-400">Loading projects…</div>
      )}

      {projects && projects.length === 0 && (
        <div className="card flex flex-col items-center gap-3 p-14 text-center">
          <FolderPlus size={28} className="text-slate-300" />
          <p className="text-sm text-slate-500">
            No projects yet. Start by importing a baseline schedule to create your first project.
          </p>
          <Link href="/pm/new-project" className="btn-primary mt-2">
            Start New Project
          </Link>
        </div>
      )}

      {projects && projects.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <div key={p.projectId} className="card flex flex-col gap-4 p-5">
              <div>
                <p className="font-mono text-xs text-slate-400">{p.projectId}</p>
                <h3 className="mt-0.5 text-base font-semibold text-navy-900">{p.projectName}</h3>
                <p className="mt-0.5 text-xs text-slate-400">Created {formatDate(p.createdAt)}</p>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
                  <span>Overall progress</span>
                  <span className="font-medium text-navy-900">{formatPct(p.overallProgressPct)}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-teal-500"
                    style={{ width: `${p.overallProgressPct}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-slate-50 p-2.5">
                  <p className="text-slate-400">Total Activities</p>
                  <p className="mt-0.5 text-sm font-semibold text-navy-900">{p.totalActivities}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5">
                  <p className="text-slate-400">Completed</p>
                  <p className="mt-0.5 text-sm font-semibold text-teal-600">{p.completedActivities}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5">
                  <p className="text-slate-400">In Progress</p>
                  <p className="mt-0.5 text-sm font-semibold text-amber-600">{p.inProgressActivities}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5">
                  <p className="text-slate-400">Delayed</p>
                  <p className="mt-0.5 text-sm font-semibold text-danger-500">{p.delayedActivities}</p>
                </div>
              </div>

              {p.pendingAiAuditReviews > 0 && (
                <StatusChip value="FLAG_FOR_REVIEW" label={`${p.pendingAiAuditReviews} pending AI audit review(s)`} />
              )}

              <div className="mt-auto flex gap-2 pt-1">
                <Link href={`/pm/projects/${p.projectId}/dashboard`} className="btn-primary flex-1 text-xs">
                  View Dashboard
                  <ArrowRight size={14} />
                </Link>
                <Link href={`/pm/audit-queue?projectId=${p.projectId}`} className="btn-secondary flex-1 text-xs">
                  <ClipboardCheck size={14} />
                  Audit Queue
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </PmShell>
  );
}
