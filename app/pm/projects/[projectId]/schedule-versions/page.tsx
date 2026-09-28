"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Activity, ArrowLeft, Calculator, Check, Clock3, FileUp, RotateCw } from "lucide-react";
import { PmShell } from "@/components/PmShell";
import { formatDate } from "@/lib/utils";

interface ScheduleVersion {
  scheduleVersionId: string;
  versionNumber: number;
  status: "DRAFT" | "VALIDATED" | "APPROVED" | "CURRENT" | "SUPERSEDED" | "REJECTED";
  sourceFileName: string | null;
  createdBy: string | null;
  approvedBy: string | null;
  totalRows: number;
  importedRows: number;
  rejectedRows: number;
  createdAt: string;
  activatedAt: string | null;
}

interface ForecastResult {
  calendar: "MON_SAT";
  targetFinish: string;
  forecastFinish: string;
  finishVarianceWorkdays: number;
  criticalActivityCount: number;
  activities: {
    activityId: string;
    activityName: string;
    baselineStart: string;
    baselineFinish: string;
    durationWorkdays: number;
    earlyStart: string;
    earlyFinish: string;
    lateStart: string;
    lateFinish: string;
    totalFloatDays: number;
    isCritical: boolean;
  }[];
}

export default function ScheduleVersionsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [versions, setVersions] = useState<ScheduleVersion[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rejections, setRejections] = useState<{ rowIndex: number; activityId: string | null; reason: string }[]>([]);
  const [forecast, setForecast] = useState<{ versionNumber: number; result: ForecastResult } | null>(null);
  const [forecastingVersionId, setForecastingVersionId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/schedule-versions`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not load schedule versions.");
      setVersions(result.versions ?? []);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load schedule versions.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function stageRevision(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("Choose an .xlsx or .csv schedule file first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/schedule-versions`, {
        method: "POST",
        body: formData
      });
      const result = await response.json();
      if (!response.ok) throw new Error([result.error, ...(result.headerErrors ?? [])].filter(Boolean).join(" "));
      setFile(null);
      setRejections(result.summary.rejections ?? []);
      setNotice(`Version ${result.summary.imported ? "staged" : "created"} with ${result.summary.imported} valid activities and ${result.summary.rejected} rejected rows.`);
      await refresh();
    } catch (stageError) {
      setError(stageError instanceof Error ? stageError.message : "Could not stage schedule version.");
    } finally {
      setSubmitting(false);
    }
  }

  async function approve(version: ScheduleVersion) {
    if (!window.confirm(`Approve version ${version.versionNumber} and make it the active project schedule?`)) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/schedule-versions/${encodeURIComponent(version.scheduleVersionId)}/approve`,
        { method: "POST" }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not approve schedule version.");
      setNotice(`Version ${version.versionNumber} is now the active schedule.`);
      await refresh();
    } catch (approvalError) {
      setError(approvalError instanceof Error ? approvalError.message : "Could not approve schedule version.");
    } finally {
      setSubmitting(false);
    }
  }

  async function calculateForecast(version: ScheduleVersion) {
    setForecastingVersionId(version.scheduleVersionId);
    setError(null);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/schedule-versions/${encodeURIComponent(version.scheduleVersionId)}/forecast`
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not calculate CPM forecast.");
      setForecast({ versionNumber: result.versionNumber, result: result.forecast });
    } catch (forecastError) {
      setError(forecastError instanceof Error ? forecastError.message : "Could not calculate CPM forecast.");
    } finally {
      setForecastingVersionId(null);
    }
  }

  return (
    <PmShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href={`/pm/projects/${encodeURIComponent(projectId)}/dashboard`} className="mb-3 inline-flex items-center gap-2 text-xs text-slate-500 hover:text-navy-800">
            <ArrowLeft size={14} /> Project dashboard
          </Link>
          <h1 className="text-2xl font-semibold text-navy-900">Schedule Versions</h1>
          <p className="mt-1 font-mono text-xs text-slate-500">{projectId}</p>
        </div>
        <button type="button" onClick={() => void refresh()} className="btn-secondary text-xs" title="Refresh schedule versions">
          <RotateCw size={14} /> Refresh
        </button>
      </div>

      <form onSubmit={stageRevision} className="card mb-6 flex flex-wrap items-end gap-4 p-5">
        <div className="min-w-60 flex-1">
          <label htmlFor="schedule-revision" className="label-field">Stage a schedule revision</label>
          <input
            id="schedule-revision"
            type="file"
            accept=".xlsx,.csv"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="input-field text-sm"
          />
          <p className="mt-1 text-xs text-slate-500">This creates an inactive version; it does not replace the current schedule. Optional WBS codes distinguish same-named nodes. Use semicolon-separated links such as ACT-01:FS:0; ACT-02:SS:2 (lag in days).</p>
        </div>
        <button type="submit" disabled={submitting || !file} className="btn-primary">
          <FileUp size={15} /> {submitting ? "Staging…" : "Stage revision"}
        </button>
      </form>

      {error && <div role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      {notice && <div role="status" className="mb-4 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-800">{notice}</div>}
      {forecast && (
        <section className="mb-6" aria-label="CPM forecast results">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-navy-900">CPM Forecast · Version {forecast.versionNumber}</h2>
              <p className="mt-1 text-xs text-slate-500">Mon–Sat, 8 hours/day · workday durations and lags · baseline unchanged · excludes actual progress, holidays, and resource limits</p>
            </div>
            <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Activity size={14} /> {forecast.result.criticalActivityCount} critical activities</span>
          </div>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="card p-4"><p className="text-xs text-slate-500">Forecast finish</p><p className="mt-1 text-lg font-semibold text-navy-900">{formatDate(forecast.result.forecastFinish)}</p></div>
            <div className="card p-4"><p className="text-xs text-slate-500">Baseline finish target</p><p className="mt-1 text-lg font-semibold text-navy-900">{formatDate(forecast.result.targetFinish)}</p></div>
            <div className="card p-4"><p className="text-xs text-slate-500">Finish variance</p><p className={`mt-1 text-lg font-semibold ${forecast.result.finishVarianceWorkdays > 0 ? "text-rose-700" : "text-teal-700"}`}>{forecast.result.finishVarianceWorkdays > 0 ? "+" : ""}{forecast.result.finishVarianceWorkdays} workdays</p></div>
          </div>
          <div className="card overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-3 text-xs font-semibold text-navy-900">Critical activities</div>
            {forecast.result.criticalActivityCount === 0 ? <p className="p-5 text-sm text-slate-500">No activities are critical against the baseline finish target.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-2">Activity</th><th className="px-4 py-2">Baseline</th><th className="px-4 py-2">Early dates</th><th className="px-4 py-2">Late dates</th><th className="px-4 py-2 text-right">Float</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {forecast.result.activities.filter((activity) => activity.isCritical).map((activity) => (
                      <tr key={activity.activityId}>
                        <td className="px-4 py-2"><span className="font-medium text-navy-900">{activity.activityName}</span><span className="ml-2 font-mono text-[10px] text-slate-400">{activity.activityId}</span></td>
                        <td className="whitespace-nowrap px-4 py-2 text-slate-600">{formatDate(activity.baselineStart)} – {formatDate(activity.baselineFinish)}</td>
                        <td className="whitespace-nowrap px-4 py-2 text-slate-600">{formatDate(activity.earlyStart)} – {formatDate(activity.earlyFinish)}</td>
                        <td className="whitespace-nowrap px-4 py-2 text-slate-600">{formatDate(activity.lateStart)} – {formatDate(activity.lateFinish)}</td>
                        <td className="px-4 py-2 text-right font-semibold text-rose-700">{activity.totalFloatDays}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}
      {rejections.length > 0 && (
        <div className="card mb-6 overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-amber-800">Rejected rows</div>
          <div className="max-h-64 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-500">
                <tr><th className="px-4 py-2">Row</th><th className="px-4 py-2">Activity ID</th><th className="px-4 py-2">Reason</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rejections.map((rejection) => (
                  <tr key={`${rejection.rowIndex}-${rejection.activityId ?? "missing"}`}>
                    <td className="px-4 py-2">{rejection.rowIndex}</td>
                    <td className="px-4 py-2 font-mono">{rejection.activityId ?? "—"}</td>
                    <td className="px-4 py-2 text-slate-600">{rejection.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="grid grid-cols-[1fr_auto] items-center border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-navy-900">Version history</h2>
          <span className="text-xs text-slate-500">{versions.length} versions</span>
        </div>
        {loading ? <p className="p-8 text-center text-sm text-slate-500">Loading schedule versions…</p> : versions.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">No schedule versions have been recorded.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {versions.map((version) => (
              <div key={version.scheduleVersionId} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-navy-900">Version {version.versionNumber}</p>
                    <span className={`chip ${version.status === "CURRENT" ? "chip-teal" : version.status === "VALIDATED" ? "chip-amber" : ""}`}>
                      {version.status}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-500">{version.sourceFileName ?? "Existing schedule data"}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {version.importedRows} activities · {version.rejectedRows} rejected · created {formatDate(version.createdAt)}
                    {version.activatedAt ? ` · activated ${formatDate(version.activatedAt)}` : ""}
                  </p>
                  {(version.createdBy || version.approvedBy) && (
                    <p className="mt-1 text-xs text-slate-400">
                      {version.createdBy ? `Uploaded by ${version.createdBy}` : ""}
                      {version.createdBy && version.approvedBy ? " · " : ""}
                      {version.approvedBy ? `Approved by ${version.approvedBy}` : ""}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(version.status === "VALIDATED" || version.status === "CURRENT") && version.rejectedRows === 0 && (
                    <button type="button" disabled={forecastingVersionId !== null} onClick={() => void calculateForecast(version)} className="btn-secondary text-xs">
                      <Calculator size={14} /> {forecastingVersionId === version.scheduleVersionId ? "Calculating…" : "Calculate CPM"}
                    </button>
                  )}
                  {version.status === "VALIDATED" && version.rejectedRows === 0 ? (
                    <button type="button" disabled={submitting} onClick={() => void approve(version)} className="btn-primary text-xs">
                      <Check size={14} /> Approve and activate
                    </button>
                  ) : version.status === "DRAFT" ? (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-700"><Clock3 size={13} /> Fix rejected rows and re-upload</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PmShell>
  );
}