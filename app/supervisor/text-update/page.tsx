"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { StatusChip } from "@/components/StatusChip";
import { ToastStack } from "@/components/Toast";
import { useToasts } from "@/lib/useToasts";

function TextUpdateInner() {
  const search = useSearchParams();
  const router = useRouter();
  const supervisorId = search.get("supervisorId") || "";
  const projectId = search.get("projectId") || "";
  const { toasts, push, dismiss } = useToasts();

  const [updateDate, setUpdateDate] = useState(new Date().toISOString().slice(0, 10));
  const [discipline, setDiscipline] = useState("");
  const [areaUnit, setAreaUnit] = useState("");
  const [text, setText] = useState("");
  const [delayReason, setDelayReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) {
      push("error", "Please describe the activity/progress update.");
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/supervisor/text-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          supervisor_id: supervisorId,
          update_date: updateDate,
          discipline: discipline || null,
          area_unit: areaUnit || null,
          activity_update_text: text,
          delay_reason: delayReason || null,
          remarks: remarks || null
        })
      });
      const data = await res.json();
      if (!res.ok) {
        push("error", data.error || "Failed to process update.");
        return;
      }
      setResult(data);
      push("success", "Update processed.");
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
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <button onClick={() => router.push("/supervisor")} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-navy-700">
            <ArrowLeft size={16} />
            Back
          </button>
          <span className="text-sm font-semibold text-navy-900">Text Update</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-8">
        {result?.demoMode && <span className="chip chip-amber mb-4">Demo AI Mode</span>}

        {!result && (
          <form onSubmit={handleSubmit} className="card space-y-4 p-6">
            <div className="grid grid-cols-2 gap-3 text-xs text-slate-500">
              <div>
                Supervisor: <span className="font-medium text-navy-900">{supervisorId}</span>
              </div>
              <div>
                Project: <span className="font-medium text-navy-900">{projectId}</span>
              </div>
            </div>

            <div>
              <label className="label-field">Update_Date</label>
              <input type="date" className="input-field" value={updateDate} onChange={(e) => setUpdateDate(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-field">Discipline</label>
                <select className="input-field" value={discipline} onChange={(e) => setDiscipline(e.target.value)}>
                  <option value="">Select…</option>
                  <option value="CIVIL">Civil</option>
                  <option value="PIPING">Piping</option>
                  <option value="ELECTRICAL">Electrical</option>
                  <option value="INSTRUMENTATION">Instrumentation</option>
                  <option value="MECHANICAL">Mechanical</option>
                  <option value="HSE">HSE</option>
                </select>
              </div>
              <div>
                <label className="label-field">Area / Unit</label>
                <input className="input-field" value={areaUnit} onChange={(e) => setAreaUnit(e.target.value)} placeholder="Rack 3" />
              </div>
            </div>

            <div>
              <label className="label-field">Activity / Progress Update</label>
              <textarea
                className="input-field"
                rows={5}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Example: Piping crew started erection of Line 24-A spool at Rack 3 today at 9 AM. Six workers deployed."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-field">Delay Reason (optional)</label>
                <input className="input-field" value={delayReason} onChange={(e) => setDelayReason(e.target.value)} />
              </div>
              <div>
                <label className="label-field">Remarks (optional)</label>
                <input className="input-field" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
              </div>
            </div>

            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? "Processing with AI…" : "Process Update with AI"}
            </button>
          </form>
        )}

        {result && (
          <div className="card space-y-5 p-6">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip value={result.matchStatus} />
              <StatusChip value={result.decision} />
            </div>

            <DetailRow label="Update ID" value={result.updateId} mono />
            <DetailRow label="Original Input" value={text} block />

            {result.llmExtraction && (
              <div>
                <p className="mb-2 text-xs font-medium text-slate-500">Extracted Information</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(result.llmExtraction)
                    .filter(([k]) => !["missing_fields", "ambiguous_fields"].includes(k))
                    .map(([k, v]: [string, any]) => (
                      <div key={k} className="rounded-lg bg-slate-50 p-2 text-xs">
                        <p className="text-slate-400">{k.replace(/_/g, " ")}</p>
                        <p className="font-medium text-navy-900">{v?.value ?? "—"}</p>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {result.candidates?.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-slate-500">Candidate Matches</p>
                <div className="space-y-1.5">
                  {result.candidates.map((c: any) => (
                    <div key={c.activity_id} className="flex justify-between rounded-lg bg-slate-50 p-2.5 text-xs">
                      <span className="text-navy-900">
                        {c.activity_name} <span className="font-mono text-slate-400">({c.activity_id})</span>
                      </span>
                      <span className="font-medium text-slate-500">{c.similarity}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DetailRow label="Confidence Score" value={`${result.confidence.overall_score}%`} />
            <DetailRow label="Audit Reason" value={result.reason} block />
            <DetailRow
              label="Outcome"
              value={
                result.decision === "AUTO_ACCEPT" || result.decision === "ACCEPT_MONITOR"
                  ? "Schedule actuals were applied automatically."
                  : "Sent to Program Manager review queue. Schedule actuals were not changed."
              }
              block
            />

            <button
              className="btn-secondary w-full"
              onClick={() => {
                setResult(null);
                setText("");
              }}
            >
              Submit Another Update
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function DetailRow({ label, value, mono, block }: { label: string; value: string; mono?: boolean; block?: boolean }) {
  return (
    <div className={block ? "" : "flex justify-between text-sm"}>
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`${block ? "mt-1 block rounded-lg bg-slate-50 p-3" : ""} ${mono ? "font-mono text-xs" : "text-sm"} text-navy-900`}>
        {value}
      </span>
    </div>
  );
}

export default function TextUpdatePage() {
  return (
    <Suspense fallback={null}>
      <TextUpdateInner />
    </Suspense>
  );
}
