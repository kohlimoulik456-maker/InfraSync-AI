"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { PmShell } from "@/components/PmShell";
import { StatusChip } from "@/components/StatusChip";
import { formatDate } from "@/lib/utils";
import { ToastStack } from "@/components/Toast";
import { useToasts } from "@/lib/useToasts";
import { CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const CONFIDENCE_CRITERIA = [
  {
    key: "semanticSimilarity" as const,
    label: "Semantic Similarity",
    weight: 40,
    description: "Token overlap between the supervisor update and the matched activity name, keywords, and search text.",
    color: "#0F2A4A"
  },
  {
    key: "scheduleConsistency" as const,
    label: "Schedule Consistency",
    weight: 25,
    description: "Date logic, status transitions, planned-window fit, and predecessor heuristics.",
    color: "#12866F"
  },
  {
    key: "contextMatch" as const,
    label: "Context Match",
    weight: 20,
    description: "Discipline, area, asset tag, and field-keyword alignment. Explicit discipline mismatch scores 0.",
    color: "#C97A0C"
  },
  {
    key: "ruleValidation" as const,
    label: "Rule Validation",
    weight: 15,
    description: "Project membership, input presence, date validity, and prohibited conflicts.",
    color: "#3B6EA5"
  }
];

export default function AuditDetailPage() {
  const params = useParams<{ matchId: string }>();
  const router = useRouter();
  const { toasts, push, dismiss } = useToasts();

  const [match, setMatch] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<string>("");
  const [overrideReason, setOverrideReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError(null);
    fetch(`/api/audit/${params.matchId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        console.log('Audit data:', d);
        setMatch(d.match);
      })
      .catch((err) => {
        console.error('Load error:', err);
        setError(err.message || 'Failed to load audit record');
      });
  }, [params.matchId]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    try {
      const res = await fetch(`/api/audit/${params.matchId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reviewed_by: "Program Manager (Demo)", override_reason: overrideReason, ...extra })
      });
      const data = await res.json();
      if (!res.ok) {
        push("error", data.error || "Action failed.");
        return;
      }
      push("success", "Audit record updated.");
      load();
    } catch {
      push("error", "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <PmShell>
        <div className="card border-danger-500 bg-danger-50 p-10 text-center">
          <p className="text-sm font-medium text-danger-600">Error loading audit record</p>
          <p className="mt-2 text-xs text-danger-500">{error}</p>
          <button onClick={() => router.back()} className="btn-secondary mt-4">
            ← Back to Audit Queue
          </button>
        </div>
      </PmShell>
    );
  }

  if (!match) {
    return (
      <PmShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 animate-spin rounded-full border-4 border-slate-200 border-t-navy-600"></div>
            <p className="text-sm font-medium text-slate-600">Loading audit record...</p>
          </div>
        </div>
      </PmShell>
    );
  }

  return (
    <PmShell>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <button onClick={() => router.back()} className="mb-4 text-xs text-slate-500 hover:text-navy-700">
        ← Back to Audit Queue
      </button>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-navy-900">Audit Detail</h1>
          <p className="mt-1 font-mono text-xs text-slate-400">{match.id}</p>
        </div>
        <div className="flex gap-2">
          <StatusChip value={match.matchStatus} />
          <StatusChip value={match.decision} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Supervisor Update">
            <div className="space-y-2 text-sm">
              <Row label="Supervisor ID" value={match.update?.supervisorId || "—"} />
              <Row label="Discipline" value={match.update?.discipline || "—"} />
              <Row label="Area" value={match.update?.areaUnit || "—"} />
              <Row label="Update Date" value={formatDate(match.update?.createdAt)} />
              <Row label="Description" value={match.update?.activityDescription || "—"} block />
            </div>
          </Section>

          {match.activity && (
            <Section title="Matched Activity">
              <div className="space-y-2 text-sm">
                <Row label="Activity Name" value={match.activity.activityName} />
                <Row label="Activity ID" value={match.activity.activityId} block />
                <Row label="Discipline" value={match.activity.discipline} />
                <Row label="Status" value={match.activity.activityStatus} />
                <Row label="Planned Finish" value={formatDate(match.activity.plannedFinish)} />
              </div>
            </Section>
          )}

          <Section title="AI Analysis">
            <div className="space-y-4">
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Overall = <span className="font-medium text-navy-900">40% semantic</span> +{" "}
                <span className="font-medium text-navy-900">25% schedule</span> +{" "}
                <span className="font-medium text-navy-900">20% context</span> +{" "}
                <span className="font-medium text-navy-900">15% rules</span>
              </p>

              <ConfidenceGraph
                label="Overall Confidence"
                value={match.overallConfidence || 0}
                description="Weighted blend of the four criteria below. ≥90 auto-accept, ≥80 monitor, ≥60 flag for review, else no match."
                size="lg"
              />

              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Weighted contribution to overall
                </p>
                <ContributionChart match={match} />
              </div>

              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Criterion scores
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {CONFIDENCE_CRITERIA.map((c) => {
                    const raw = match[c.key];
                    const value = raw == null ? null : Number(raw);
                    return (
                      <ConfidenceGraph
                        key={c.key}
                        label={c.label}
                        value={value}
                        weight={c.weight}
                        description={c.description}
                        color={c.color}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-xs text-slate-500">Decision</p>
                  <p className="mt-1 font-semibold text-navy-900">{match.decision}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-xs text-slate-500">Status</p>
                  <p className="mt-1 font-semibold text-navy-900">{match.matchStatus}</p>
                </div>
              </div>
            </div>
          </Section>
        </div>

        <div className="card h-fit space-y-4 p-5">
          <h3 className="text-sm font-semibold text-navy-900">Manager Actions</h3>
          <textarea
            className="input-field text-sm"
            rows={2}
            placeholder="Override reason (optional)"
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
          />
          <button
            disabled={busy || !match.activityId}
            onClick={() => act("APPROVE")}
            className="btn-primary w-full"
          >
            <CheckCircle2 size={16} />
            Approve Match
          </button>
          <button disabled={busy} onClick={() => act("MARK_UNMATCHED")} className="btn-secondary w-full">
            <HelpCircle size={16} />
            Mark Unmatched
          </button>
          <button
            disabled={busy}
            onClick={() => act("REJECT_INVALID")}
            className="btn-secondary w-full text-danger-500 hover:bg-danger-50"
          >
            <XCircle size={16} />
            Reject Invalid Input
          </button>
        </div>
      </div>
    </PmShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h3 className="mb-3 text-sm font-semibold text-navy-900">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value, block }: { label: string; value?: string; block?: boolean }) {
  return (
    <div className={block ? "" : "flex justify-between gap-4"}>
      <span className="text-slate-400">{label}</span>
      <span className={block ? "mt-1 block rounded-lg bg-slate-50 p-3 text-navy-900" : "font-medium text-navy-900"}>{value || "—"}</span>
    </div>
  );
}

function barTone(value: number) {
  if (value >= 90) return "bg-green-500";
  if (value >= 80) return "bg-blue-500";
  if (value >= 60) return "bg-amber-500";
  return "bg-red-500";
}

function ConfidenceGraph({
  label,
  value,
  weight,
  description,
  color,
  size = "md"
}: {
  label: string;
  value: number | null;
  weight?: number;
  description: string;
  color?: string;
  size?: "md" | "lg";
}) {
  const score = value ?? 0;
  const contribution = weight != null && value != null ? (value * weight) / 100 : null;

  return (
    <div
      className={`rounded-lg bg-gradient-to-br from-navy-50 to-slate-50 ${size === "lg" ? "p-5" : "p-4"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          {weight != null && (
            <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-400">{weight}% of overall</p>
          )}
        </div>
        <div className="text-right">
          <p className={size === "lg" ? "text-4xl font-bold text-navy-900" : "text-2xl font-bold text-navy-900"}>
            {value == null ? "—" : `${value.toFixed(1)}%`}
          </p>
          {contribution != null && <p className="text-xs text-slate-500">→ {contribution.toFixed(1)} pts</p>}
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">{description}</p>
      <div className={`mt-3 overflow-hidden rounded-full bg-slate-200 ${size === "lg" ? "h-3" : "h-2.5"}`}>
        <div
          className={`h-full rounded-full transition-all ${color ? "" : barTone(score)}`}
          style={{ width: `${Math.min(100, Math.max(0, score))}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function ContributionChart({ match }: { match: any }) {
  const hasBreakdown = CONFIDENCE_CRITERIA.some((c) => match[c.key] != null);
  if (!hasBreakdown) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-xs text-slate-400">
        Criterion scores were not stored on this record. New pipeline matches save all four components.
      </p>
    );
  }

  const row: Record<string, number | string> = { name: "Overall" };
  CONFIDENCE_CRITERIA.forEach((c) => {
    row[c.key] = Number((((match[c.key] || 0) * c.weight) / 100).toFixed(1));
  });

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <ResponsiveContainer width="100%" height={72}>
        <BarChart data={[row]} layout="vertical" margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis type="category" dataKey="name" hide />
          <Tooltip
            formatter={(value: number, name: string) => {
              const criterion = CONFIDENCE_CRITERIA.find((c) => c.key === name);
              return [`${value} pts`, criterion?.label ?? name];
            }}
            contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "12px" }}
          />
          {CONFIDENCE_CRITERIA.map((c) => (
            <Bar key={c.key} dataKey={c.key} stackId="overall" fill={c.color} radius={c.key === "ruleValidation" ? [0, 6, 6, 0] : 0} />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap gap-3">
        {CONFIDENCE_CRITERIA.map((c) => (
          <span key={c.key} className="inline-flex items-center gap-1.5 text-[10px] text-slate-600">
            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: c.color }} />
            {c.label} ({c.weight}%)
          </span>
        ))}
      </div>
    </div>
  );
}
