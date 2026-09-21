"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { PmShell } from "@/components/PmShell";
import { StatusChip } from "@/components/StatusChip";
import { formatDate } from "@/lib/utils";

const STATUS_FILTERS = ["FLAG_FOR_REVIEW", "AMBIGUOUS", "NO_MATCH", "REJECTED", "INVALID"];

function AuditQueueInner() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") || undefined;

  const [matches, setMatches] = useState<any[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const load = useCallback(() => {
    const q = new URLSearchParams();
    if (projectId) q.set("projectId", projectId);
    if (statusFilter) q.set("matchStatus", statusFilter);
    fetch(`/api/audit?${q.toString()}`)
      .then((r) => r.json())
      .then((d) => setMatches(d.matches));
  }, [projectId, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <PmShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">AI Audit Queue</h1>
          <p className="mt-1 text-sm text-slate-500">
            {projectId ? `Filtered to project ${projectId}` : "All projects"}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip label="All" active={statusFilter === ""} onClick={() => setStatusFilter("")} />
          {STATUS_FILTERS.map((s) => (
            <FilterChip key={s} label={s.replace(/_/g, " ")} active={statusFilter === s} onClick={() => setStatusFilter(s)} />
          ))}
        </div>
      </div>

      {matches === null && <div className="card p-10 text-center text-sm text-slate-400">Loading audit records…</div>}

      {matches && matches.length === 0 && (
        <div className="card p-14 text-center text-sm text-slate-400">No audit records match this filter.</div>
      )}

      {matches && matches.length > 0 && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3">Update</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Suggested Activity</th>
                <th className="px-4 py-3">Confidence (by criterion)</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Decision</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {matches.map((m) => (
                <tr key={m.id}>
                  <td className="max-w-[220px] px-4 py-3">
                    <p className="truncate text-navy-900">{m.update.activityDescription}</p>
                    <p className="text-[10px] text-slate-400">{m.update.supervisorId}</p>
                  </td>
                  <td className="px-4 py-3">{m.update.sourceType}</td>
                  <td className="px-4 py-3">
                    {m.activity ? (
                      <>
                        <p className="text-navy-900">{m.activity.activityName}</p>
                        <p className="font-mono text-[10px] text-slate-400">{m.activity.activityId}</p>
                      </>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="min-w-[180px] px-4 py-3">
                    <p className="font-medium text-navy-900">{m.overallConfidence}%</p>
                    {m.semanticSimilarity != null || m.scheduleConsistency != null || m.contextMatch != null || m.ruleValidation != null ? (
                      <>
                        <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full bg-navy-800" style={{ width: `${((m.semanticSimilarity || 0) * 0.4)}%` }} title="Semantic" />
                          <div className="h-full bg-teal-600" style={{ width: `${((m.scheduleConsistency || 0) * 0.25)}%` }} title="Schedule" />
                          <div className="h-full bg-amber-500" style={{ width: `${((m.contextMatch || 0) * 0.2)}%` }} title="Context" />
                          <div className="h-full bg-blue-500" style={{ width: `${((m.ruleValidation || 0) * 0.15)}%` }} title="Rules" />
                        </div>
                        <p className="mt-1 text-[10px] text-slate-400">
                          S {Number(m.semanticSimilarity || 0).toFixed(0)} · Sch {Number(m.scheduleConsistency || 0).toFixed(0)} · Ctx {Number(m.contextMatch || 0).toFixed(0)} · R {Number(m.ruleValidation || 0).toFixed(0)}
                        </p>
                      </>
                    ) : (
                      <p className="mt-1 text-[10px] text-slate-400">Breakdown not stored</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusChip value={m.matchStatus} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusChip value={m.decision} />
                  </td>
                  <td className="px-4 py-3 text-slate-400">{formatDate(m.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/pm/audit-queue/${m.id}`} className="font-medium text-navy-700 hover:underline">
                      View Audit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PmShell>
  );
}

export default function AuditQueuePage() {
  return (
    <Suspense fallback={<PmShell><div className="card p-10 text-center text-sm text-slate-400">Loading audit queue…</div></PmShell>}>
      <AuditQueueInner />
    </Suspense>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
        active ? "bg-navy-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      {label}
    </button>
  );
}
