"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, FileSpreadsheet, Mic, ScanLine, ArrowLeft } from "lucide-react";
import { ComingSoonModal } from "@/components/ComingSoonModal";

interface Project {
  projectId: string;
  projectName: string;
}

export default function SupervisorEntryPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [supervisorId, setSupervisorId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [modal, setModal] = useState<"voice" | "diary" | null>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects.map((p: any) => ({ projectId: p.projectId, projectName: p.projectName }))));
  }, []);

  const canProceed = supervisorId.trim().length > 0 && projectId.length > 0;

  function goTo(path: string) {
    if (!canProceed) return;
    const params = new URLSearchParams({ supervisorId, projectId });
    router.push(`${path}?${params.toString()}`);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-100 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-navy-700">
            <ArrowLeft size={16} />
            Back
          </Link>
          <span className="text-sm font-semibold text-navy-900">Supervisor</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="card mb-6 space-y-4 p-6">
          <div>
            <label className="label-field">Supervisor_ID</label>
            <input
              className="input-field"
              placeholder="SUP-101"
              value={supervisorId}
              onChange={(e) => setSupervisorId(e.target.value)}
            />
          </div>
          <div>
            <label className="label-field">Project</label>
            <select className="input-field" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">Select a project…</option>
              {projects.map((p) => (
                <option key={p.projectId} value={p.projectId}>
                  {p.projectName} ({p.projectId})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-3 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-500">
          Text, Excel, and Voice updates are active. Diary OCR remains a future enhancement.
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <InputCard
            icon={<FileText size={22} />}
            title="Text Update"
            description="Describe today's progress in your own words. AI extracts and maps it to your schedule."
            badge="MVP Available"
            badgeTone="teal"
            disabled={!canProceed}
            onClick={() => goTo("/supervisor/text-update")}
          />
          <InputCard
            icon={<FileSpreadsheet size={22} />}
            title="Excel Upload"
            description="Submit multiple activity updates at once using the supervisor Excel/CSV format."
            badge="MVP Available"
            badgeTone="teal"
            disabled={!canProceed}
            onClick={() => goTo("/supervisor/excel-upload")}
          />
          <InputCard
            icon={<Mic size={22} />}
            title="Voice Update"
            description="Speak your update and let AI transcribe it."
            badge="Live"
            badgeTone="teal"
            disabled={!canProceed}
            onClick={() => goTo("/supervisor/voice")}
          />
          <InputCard
            icon={<ScanLine size={22} />}
            title="Scan Site Diary"
            description="Capture a handwritten site diary page for OCR extraction."
            badge="Coming Soon"
            badgeTone="amber"
            disabled={false}
            onClick={() => setModal("diary")}
          />
        </div>

        {!canProceed && (
          <p className="mt-4 text-center text-xs text-slate-400">
            Enter your Supervisor_ID and select a project to enable Text Update or Excel Upload.
          </p>
        )}
      </main>

      <ComingSoonModal
        open={modal === "diary"}
        onClose={() => setModal(null)}
        title="Scan Diary / OCR Module — Coming Soon"
        message="Handwritten diary OCR and scanned-document extraction will be available in the next release. For the current prototype, please submit your progress update using Text Update or Excel Upload."
        onUseText={() => {
          setModal(null);
          goTo("/supervisor/text-update");
        }}
        onUseExcel={() => {
          setModal(null);
          goTo("/supervisor/excel-upload");
        }}
      />
    </div>
  );
}

function InputCard({
  icon,
  title,
  description,
  badge,
  badgeTone,
  disabled,
  onClick
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge: string;
  badgeTone: "teal" | "amber";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled && badgeTone === "teal"}
      className="card flex flex-col items-start gap-3 p-5 text-left transition hover:border-navy-200 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
    >
      <div className="flex w-full items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-50 text-navy-700">{icon}</div>
        <span className={`chip ${badgeTone === "teal" ? "chip-teal" : "chip-amber"}`}>{badge}</span>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-navy-900">{title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>
      </div>
    </button>
  );
}
