"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PmShell } from "@/components/PmShell";
import { Download, Upload, FileSpreadsheet } from "lucide-react";
import { ToastStack } from "@/components/Toast";
import { useToasts } from "@/lib/useToasts";

interface ImportSummary {
  totalRows: number;
  imported: number;
  rejected: number;
  duplicateActivityIds: string[];
  disciplinesDetected: string[];
  rejections: { rowIndex: number; activityId: string | null; reason: string }[];
  fundTransactionsImported?: number;
  supervisorUpdatesImported?: number;
}

export default function NewProjectPage() {
  const router = useRouter();
  const { toasts, push, dismiss } = useToasts();
  const fileInput = useRef<HTMLInputElement>(null);

  const [projectId, setProjectId] = useState("JUDGE-DEMO-2026");
  const [projectName, setProjectName] = useState("Smart City Infrastructure Demo");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [importedProjectId, setImportedProjectId] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors([]);
    setSummary(null);

    if (!projectId.trim() || !projectName.trim()) {
      setErrors(["Project_ID and Project_Name are required."]);
      return;
    }
    if (!file) {
      setErrors(["Please upload a baseline schedule file (.xlsx or .csv)."]);
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("project_id", projectId.trim());
      formData.append("project_name", projectName.trim());
      formData.append("file", file);

      const res = await fetch("/api/projects/import", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setErrors(data.headerErrors ?? [data.error || "Import failed."]);
        push("error", data.error || "Schedule import failed.");
        return;
      }

      setSummary({
        ...data.summary,
        fundTransactionsImported: data.fundTransactionsImported,
        supervisorUpdatesImported: data.supervisorUpdatesImported
      });
      setImportedProjectId(data.projectId);
      push("success", `Project "${projectId}" created and schedule imported.`);
    } catch {
      push("error", "Something went wrong while importing the schedule.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PmShell>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-navy-900">Start New Project</h1>
        <p className="mt-1 text-sm text-slate-500">Create a project by importing a baseline Primavera/MS Project schedule export.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <form onSubmit={handleSubmit} className="card space-y-5 p-6 lg:col-span-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label-field">Project_ID (unique, required)</label>
              <input
                className="input-field"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="REFINERY-A-2026"
              />
            </div>
            <div>
              <label className="label-field">Project_Name (required)</label>
              <input
                className="input-field"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Refinery Block A Execution Demo"
              />
            </div>
          </div>

          <div>
            <label className="label-field">Upload Primavera/MS Project Schedule Export</label>
            <p className="mb-2 text-xs text-slate-500">
              For this MVP, import the schedule as Excel or CSV. Primavera XER/XML parsing and direct P6 API synchronization are future enhancements.
            </p>
            <div className="flex items-center gap-3 rounded-lg border border-dashed border-slate-300 p-4">
              <FileSpreadsheet size={22} className="text-slate-400" />
              <div className="flex-1 text-sm">
                {file ? (
                  <span className="text-navy-900">{file.name}</span>
                ) : (
                  <span className="text-slate-400">No file selected — .xlsx or .csv</span>
                )}
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
          </div>

          {errors.length > 0 && (
            <div className="rounded-lg border border-danger-500/30 bg-danger-50 p-3 text-sm text-danger-500">
              <ul className="list-inside list-disc space-y-0.5">
                {errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? "Importing…" : "Create Project & Import Schedule"}
          </button>
        </form>

        <div className="card h-fit space-y-3 p-6">
          <h3 className="text-sm font-semibold text-navy-900">Templates</h3>
          <a href="/api/templates/schedule" className="btn-secondary w-full text-xs">
            <Download size={14} />
            Download Schedule Excel Format
          </a>
          <a href="/api/templates/schedule-sample" className="btn-secondary w-full text-xs">
            <Download size={14} />
            Download Sample Schedule
          </a>
          <a href="/api/templates/presentation" className="btn-primary w-full text-xs">
            <Download size={14} />
            Download Judge Demo Workbook
          </a>
          <div className="border-t border-slate-100 pt-3">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">Separate judge inputs</p>
            <div className="grid grid-cols-1 gap-2">
              <a href="/api/templates/presentation-schedule" className="btn-secondary w-full text-xs"><Download size={13} />Schedule Input</a>
              <a href="/api/templates/presentation-updates" className="btn-secondary w-full text-xs"><Download size={13} />Supervisor Updates Input</a>
              <a href="/api/templates/presentation-funds" className="btn-secondary w-full text-xs"><Download size={13} />Fund Transactions Input</a>
            </div>
          </div>
          <p className="pt-2 text-xs leading-relaxed text-slate-400">
            The judge workbook includes schedule, fund transactions, supervisor updates, and a read-me sheet. Upload it
            here to create a complete live demo project.
          </p>
        </div>
      </div>

      {summary && (
        <div className="card mt-6 p-6">
          <h3 className="mb-4 text-base font-semibold text-navy-900">Import Summary</h3>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryStat label="Total Rows" value={summary.totalRows} />
            <SummaryStat label="Imported" value={summary.imported} tone="teal" />
            <SummaryStat label="Rejected" value={summary.rejected} tone="danger" />
            <SummaryStat label="Duplicate IDs" value={summary.duplicateActivityIds.length} tone="amber" />
            <SummaryStat label="Fund Entries" value={summary.fundTransactionsImported ?? 0} tone="teal" />
            <SummaryStat label="Field Updates" value={summary.supervisorUpdatesImported ?? 0} tone="teal" />
          </div>
          <p className="mb-3 text-xs text-slate-500">
            Disciplines detected: {summary.disciplinesDetected.join(", ") || "none"}
          </p>

          {summary.rejections.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-slate-100">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Row</th>
                    <th className="px-3 py-2">Activity_ID</th>
                    <th className="px-3 py-2">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summary.rejections.map((r, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2">{r.rowIndex}</td>
                      <td className="px-3 py-2 font-mono">{r.activityId ?? "—"}</td>
                      <td className="px-3 py-2 text-slate-600">{r.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {importedProjectId && (
            <button
              className="btn-primary mt-5"
              onClick={() => router.push(`/pm/projects/${importedProjectId}/dashboard`)}
            >
              Go to Project Dashboard
            </button>
          )}
        </div>
      )}
    </PmShell>
  );
}

function SummaryStat({ label, value, tone }: { label: string; value: number; tone?: "teal" | "danger" | "amber" }) {
  const toneClass =
    tone === "teal" ? "text-teal-600" : tone === "danger" ? "text-danger-500" : tone === "amber" ? "text-amber-600" : "text-navy-900";
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
