"use client";

import { useRef, useState, Suspense, Fragment } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, Upload, FileSpreadsheet } from "lucide-react";
import { StatusChip } from "@/components/StatusChip";
import { ToastStack } from "@/components/Toast";
import { useToasts } from "@/lib/useToasts";

function ExcelUploadInner() {
  const search = useSearchParams();
  const router = useRouter();
  const supervisorId = search.get("supervisorId") || "";
  const projectId = search.get("projectId") || "";
  const { toasts, push, dismiss } = useToasts();
  const fileInput = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  if (!supervisorId || !projectId) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center text-sm text-slate-500">
        Missing Supervisor_ID or Project.{" "}
        <Link href="/supervisor" className="text-navy-700 underline">
          Go back
        </Link>
      </div>
    );
  }

  async function handleSubmit() {
    if (!file) {
      push("error", "Please choose a file to upload.");
      return;
    }
    setSubmitting(true);
    setSummary(null);
    try {
      const formData = new FormData();
      formData.append("project_id", projectId);
      formData.append("supervisor_id", supervisorId);
      formData.append("file", file);

      const res = await fetch("/api/supervisor/excel-upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        push("error", data.error || "Upload failed.");
        return;
      }
      setSummary(data.summary);
      setDemoMode(data.demoMode);
      push("success", "Batch processed.");
    } catch {
      push("error", "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <header className="border-b border-slate-100 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <button onClick={() => router.push("/supervisor")} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-navy-700">
            <ArrowLeft size={16} />
            Back
          </button>
          <span className="text-sm font-semibold text-navy-900">Excel Upload</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        {demoMode && <span className="chip chip-amber mb-4">Demo AI Mode</span>}

        <div className="card mb-6 space-y-4 p-6">
          <div className="grid grid-cols-2 gap-3 text-xs text-slate-500">
            <div>
              Supervisor: <span className="font-medium text-navy-900">{supervisorId}</span>
            </div>
            <div>
              Project: <span className="font-medium text-navy-900">{projectId}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-dashed border-slate-300 p-4">
            <FileSpreadsheet size={22} className="text-slate-400" />
            <div className="flex-1 text-sm">
              {file ? <span className="text-navy-900">{file.name}</span> : <span className="text-slate-400">No file selected — .xlsx or .csv</span>}
            </div>
            <button type="button" className="btn-secondary text-xs" onClick={() => fileInput.current?.click()}>
              <Upload size={14} />
              Choose File
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <a href="/api/templates/supervisor" className="btn-secondary text-xs">
              <Download size={14} />
              Download Supervisor Excel Format
            </a>
            <a href="/api/templates/supervisor-sample" className="btn-secondary text-xs">
              <Download size={14} />
              Download Sample Supervisor Updates
            </a>
          </div>

          <button onClick={handleSubmit} disabled={submitting} className="btn-primary w-full">
            {submitting ? "Uploading and processing…" : "Upload and Process Updates"}
          </button>
        </div>

        {summary && (
          <div className="card p-6">
            <h3 className="mb-4 text-sm font-semibold text-navy-900">Batch Summary</h3>
            <div className="mb-6 grid grid-cols-3 gap-2 sm:grid-cols-7">
              <BatchStat label="Total" value={summary.totalRows} />
              <BatchStat label="Valid" value={summary.validRows} />
              <BatchStat label="Invalid" value={summary.invalidRows} tone="danger" />
              <BatchStat label="Auto Accepted" value={summary.autoAccepted} tone="teal" />
              <BatchStat label="Accept/Monitor" value={summary.acceptMonitor} tone="teal" />
              <BatchStat label="Review Required" value={summary.reviewRequired} tone="amber" />
              <BatchStat label="No Match" value={summary.noMatch} tone="danger" />
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-100">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Row</th>
                    <th className="px-3 py-2">Activity Description</th>
                    <th className="px-3 py-2">Suggested Activity</th>
                    <th className="px-3 py-2">Confidence</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Decision</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summary.rows.map((r: any) => (
                    <Fragment key={r.rowIndex}>
                      <tr>
                        <td className="px-3 py-2">{r.rowIndex}</td>
                        <td className="max-w-[220px] truncate px-3 py-2">{r.activityDescription || "—"}</td>
                        <td className="px-3 py-2">
                          {r.result?.activityName ? (
                            <>
                              {r.result.activityName} <span className="font-mono text-slate-400">({r.result.activityId})</span>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2">{r.result ? `${r.result.confidence.overall_score}%` : "—"}</td>
                        <td className="px-3 py-2">{r.result ? <StatusChip value={r.result.matchStatus} /> : <StatusChip value="INVALID" label="Invalid Row" />}</td>
                        <td className="px-3 py-2">{r.result && <StatusChip value={r.result.decision} />}</td>
                        <td className="px-3 py-2">
                          {r.result && (
                            <button
                              className="font-medium text-navy-700 hover:underline"
                              onClick={() => setExpandedRow(expandedRow === r.rowIndex ? null : r.rowIndex)}
                            >
                              {expandedRow === r.rowIndex ? "Hide" : "View Audit"}
                            </button>
                          )}
                        </td>
                      </tr>
                      {expandedRow === r.rowIndex && r.result && (
                        <tr>
                          <td colSpan={7} className="bg-slate-50 px-4 py-3">
                            <p className="mb-2 text-slate-600">{r.result.reason}</p>
                            <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
                              <span>Semantic: {r.result.confidence.semantic_similarity}%</span>
                              <span>Schedule: {r.result.confidence.schedule_consistency}%</span>
                              <span>Context: {r.result.confidence.context_match}%</span>
                              <span>Rule: {r.result.confidence.rule_validation}%</span>
                              <span>Top-two gap: {r.result.confidence.top_two_gap ?? "—"}</span>
                            </div>
                          </td>
                        </tr>
                      )}
                      {expandedRow === r.rowIndex && !r.result && r.errors.length > 0 && (
                        <tr>
                          <td colSpan={7} className="bg-danger-50 px-4 py-3 text-danger-500">
                            {r.errors.join(" · ")}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function BatchStat({ label, value, tone }: { label: string; value: number; tone?: "teal" | "amber" | "danger" }) {
  const toneClass = tone === "teal" ? "text-teal-600" : tone === "amber" ? "text-amber-600" : tone === "danger" ? "text-danger-500" : "text-navy-900";
  return (
    <div className="rounded-lg bg-slate-50 p-2.5 text-center">
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className={`text-sm font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

export default function ExcelUploadPage() {
  return (
    <Suspense fallback={null}>
      <ExcelUploadInner />
    </Suspense>
  );
}
