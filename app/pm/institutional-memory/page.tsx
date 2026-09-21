"use client";

import { useEffect, useState } from "react";
import { PmShell } from "@/components/PmShell";
import { Search, BookOpen } from "lucide-react";
import { ToastStack } from "@/components/Toast";
import { useToasts } from "@/lib/useToasts";

const EXAMPLES = [
  "What delayed piping spool erection in past projects?",
  "What was the actual duration of similar cable pulling work?",
  "Show common delay reasons in civil foundation work."
];

export default function InstitutionalMemoryPage() {
  const { toasts, push, dismiss } = useToasts();
  const [question, setQuestion] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [area, setArea] = useState("");
  const [contractor, setContractor] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [demoMode, setDemoMode] = useState(false);

  const [drafts, setDrafts] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/institutional-memory/lessons")
      .then((r) => r.json())
      .then((d) => setDrafts(d.lessons ?? []));
  }, []);

  async function runQuery(q?: string) {
    const finalQuestion = q ?? question;
    if (!finalQuestion.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/institutional-memory/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: finalQuestion, discipline: discipline || undefined, area: area || undefined, contractor: contractor || undefined })
      });
      const data = await res.json();
      if (!res.ok) {
        push("error", data.error || "Query failed.");
        return;
      }
      setResult(data);
      setDemoMode(data.demoMode);
      setQuestion(finalQuestion);
    } finally {
      setLoading(false);
    }
  }

  async function approve(lessonId: string) {
    const lesson = prompt("Lesson (summarized takeaway):") || "";
    const recommendation = prompt("Recommendation for future projects:") || "";
    const res = await fetch("/api/institutional-memory/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId, lesson, recommendation })
    });
    if (res.ok) {
      push("success", "Lesson approved and added to institutional memory.");
      setDrafts((d) => d.filter((x) => x.lessonId !== lessonId));
    } else {
      push("error", "Failed to approve lesson.");
    }
  }

  return (
    <PmShell>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-navy-900">Institutional Memory</h1>
        <p className="mt-1 text-sm text-slate-500">
          Advisory insights from verified actuals and manager-approved lessons only. Never used to auto-modify a new schedule.
        </p>
      </div>

      <div className="card mb-6 p-6">
        <div className="mb-3 flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input-field pl-9"
              placeholder="Ask about verified lessons from past projects"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runQuery()}
            />
          </div>
          <button onClick={() => runQuery()} disabled={loading} className="btn-primary">
            {loading ? "Searching…" : "Ask"}
          </button>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input className="input-field text-xs" placeholder="Discipline filter" value={discipline} onChange={(e) => setDiscipline(e.target.value)} />
          <input className="input-field text-xs" placeholder="Area filter" value={area} onChange={(e) => setArea(e.target.value)} />
          <input className="input-field text-xs" placeholder="Contractor filter" value={contractor} onChange={(e) => setContractor(e.target.value)} />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button key={ex} onClick={() => runQuery(ex)} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 hover:bg-slate-200">
              {ex}
            </button>
          ))}
        </div>
      </div>

      {result && (
        <div className="card mb-6 p-6">
          {demoMode && <span className="chip chip-amber mb-3">Demo AI Mode</span>}
          <h3 className="mb-2 text-sm font-semibold text-navy-900">Historical Insight</h3>
          <p className="mb-4 text-sm leading-relaxed text-slate-700">{result.summary}</p>

          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <MetricBox label="Sample Size" value={result.metrics.sampleSize} />
            <MetricBox label="Avg Planned (d)" value={result.metrics.avgPlannedDuration ?? "—"} />
            <MetricBox label="Avg Actual (d)" value={result.metrics.avgActualDuration ?? "—"} />
            <MetricBox label="Avg Delay (d)" value={result.metrics.avgDelayDays ?? "—"} />
            <MetricBox label="Avg Crew" value={result.metrics.avgCrewSize ?? "—"} />
          </div>

          {result.metrics.commonDelayReasons.length > 0 && (
            <div className="mb-3">
              <p className="mb-1.5 text-xs font-medium text-slate-500">Common Delay Reasons</p>
              <div className="flex flex-wrap gap-1.5">
                {result.metrics.commonDelayReasons.map((r: any) => (
                  <span key={r.reason} className="chip chip-slate">
                    {r.reason} · {r.count}
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            Advisory only — final schedule decisions remain with the Program Manager.
          </p>
        </div>
      )}

      <div className="card p-6">
        <div className="mb-4 flex items-center gap-2">
          <BookOpen size={18} className="text-navy-700" />
          <h3 className="text-sm font-semibold text-navy-900">Draft Lessons Pending Approval</h3>
        </div>
        {drafts.length === 0 && <p className="text-sm text-slate-400">No draft lessons awaiting review.</p>}
        <div className="space-y-3">
          {drafts.map((d) => (
            <div key={d.lessonId} className="flex items-start justify-between gap-4 rounded-lg border border-slate-100 p-4">
              <div className="text-sm">
                <p className="font-medium text-navy-900">
                  {d.discipline ?? "—"} · {d.area ?? "—"} · {d.contractor ?? "—"}
                </p>
                <p className="mt-1 text-slate-500">
                  Delay reason: {d.delayReason ?? "n/a"} · Actual duration: {d.actualDuration ?? "n/a"} days
                </p>
                {d.observation && <p className="mt-1 text-xs text-slate-400">{d.observation}</p>}
              </div>
              <button onClick={() => approve(d.lessonId)} className="btn-secondary shrink-0 text-xs">
                Approve
              </button>
            </div>
          ))}
        </div>
      </div>
    </PmShell>
  );
}

function MetricBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3 text-center">
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-navy-900">{value}</p>
    </div>
  );
}
