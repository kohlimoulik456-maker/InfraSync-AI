import Link from "next/link";
import { ClipboardCheck, Download, FileSpreadsheet, HardHat, LayoutDashboard, MessageSquareText, RotateCcw } from "lucide-react";
import { PmShell } from "@/components/PmShell";

const DEMO_UPDATES = [
  {
    label: "High-confidence auto-accept",
    text: "Piping crew started erection of Line 24-A spool at Rack 3 today at 9 AM. Six workers deployed.",
    outcome: "Shows structured extraction and automatic schedule application."
  },
  {
    label: "Ambiguous match for human review",
    text: "Spool work completed in Pipe Rack.",
    outcome: "Shows top candidates, confidence criteria, and manager decision-making."
  },
  {
    label: "No-match safety path",
    text: "Work done.",
    outcome: "Shows that uncertainty is routed to review instead of changing the schedule blindly."
  }
];

export default function DemoCenterPage() {
  return (
    <PmShell>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-teal-600">Judge-ready workspace</p>
          <h1 className="text-2xl font-semibold text-navy-900">Demo Center</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            A reliable launchpad for showing the complete InfraSync-AI loop: baseline schedule, field report, explainable AI decision, and verified project insight.
          </p>
        </div>
        <span className="chip chip-amber">Demo AI Mode available</span>
      </div>

      <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StepCard number="01" icon={<FileSpreadsheet size={18} />} title="Load the baseline" description="Import a schedule or open a seeded working project." href="/pm" action="Open Projects" />
        <StepCard number="02" icon={<HardHat size={18} />} title="Submit field reality" description="Enter a natural-language update as a supervisor." href="/supervisor" action="Open Supervisor" />
        <StepCard number="03" icon={<ClipboardCheck size={18} />} title="Resolve uncertainty" description="Inspect evidence, approve, override, or reject the AI match." href="/pm/audit-queue" action="Open Audit Queue" />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="card p-6 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <MessageSquareText size={18} className="text-navy-700" />
            <div>
              <h2 className="text-sm font-semibold text-navy-900">Recommended live scenarios</h2>
              <p className="text-xs text-slate-400">Use these in order to make the confidence-routing story visible.</p>
            </div>
          </div>
          <div className="space-y-3">
            {DEMO_UPDATES.map((update) => (
              <div key={update.label} className="rounded-lg border border-slate-100 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-navy-900">{update.label}</p>
                  <span className="text-[11px] text-slate-400">Text Update</span>
                </div>
                <p className="mt-2 rounded-md bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">“{update.text}”</p>
                <p className="mt-2 text-xs text-slate-500">{update.outcome}</p>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="card p-6">
            <h2 className="text-sm font-semibold text-navy-900">Demo utilities</h2>
            <div className="mt-4 space-y-2">
              <UtilityLink href="/api/templates/schedule-sample" icon={<Download size={15} />} label="Download sample schedule" />
              <UtilityLink href="/api/templates/supervisor-sample" icon={<Download size={15} />} label="Download sample updates" />
              <UtilityLink href="/pm/institutional-memory" icon={<RotateCcw size={15} />} label="Show institutional memory" />
            </div>
          </section>

          <section className="card border-teal-200 bg-teal-50/50 p-6">
            <div className="flex items-center gap-2 text-teal-700">
              <LayoutDashboard size={17} />
              <h2 className="text-sm font-semibold">Close with impact</h2>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-teal-800/80">
              After approving a review, return to the project dashboard and refresh it. The verified actual and project health metrics make the human-in-the-loop result tangible.
            </p>
            <Link href="/pm" className="btn-primary mt-4 w-full text-xs">Return to Projects</Link>
          </section>
        </aside>
      </div>
    </PmShell>
  );
}

function StepCard({ number, icon, title, description, href, action }: { number: string; icon: React.ReactNode; title: string; description: string; href: string; action: string }) {
  return (
    <div className="card flex flex-col p-5">
      <div className="flex items-center justify-between text-teal-600">
        <span className="font-mono text-xs font-semibold">{number}</span>
        {icon}
      </div>
      <h2 className="mt-5 text-sm font-semibold text-navy-900">{title}</h2>
      <p className="mt-1 flex-1 text-xs leading-relaxed text-slate-500">{description}</p>
      <Link href={href} className="btn-secondary mt-4 w-full text-xs">{action}</Link>
    </div>
  );
}

function UtilityLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return <a href={href} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2.5 text-xs font-medium text-slate-600 hover:border-navy-200 hover:text-navy-700">{icon}{label}</a>;
}
