import Link from "next/link";
import { HardHat, ClipboardList, ArrowRight } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-100">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-navy-700 text-sm font-bold text-white">
              IS
            </div>
            <span className="text-base font-semibold text-navy-900">InfraSync-AI</span>
          </div>
          <span className="chip chip-slate">Gemini Flash</span>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 pb-10 pt-16 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-navy-900 sm:text-5xl">InfraSync-AI</h1>
        <p className="mt-3 text-lg text-slate-500">From field updates to verified schedule actuals.</p>
        <p className="mx-auto mt-4 max-w-xl text-sm text-slate-500">
          Turn fragmented field updates into verified Primavera-ready actuals.
        </p>
      </section>

      <section className="mx-auto grid max-w-4xl grid-cols-1 gap-5 px-6 pb-20 sm:grid-cols-2">
        <Link
          href="/pm"
          className="card group flex flex-col gap-4 p-7 transition hover:border-navy-200 hover:shadow-md"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-navy-50 text-navy-700">
            <ClipboardList size={22} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-navy-900">Program Manager</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
              Create projects, upload approved schedules, monitor live progress, and review AI audit trails.
            </p>
          </div>
          <span className="mt-auto flex items-center gap-1.5 text-sm font-medium text-navy-700">
            Enter as Program Manager
            <ArrowRight size={15} className="transition group-hover:translate-x-0.5" />
          </span>
        </Link>

        <Link
          href="/supervisor"
          className="card group flex flex-col gap-4 p-7 transition hover:border-navy-200 hover:shadow-md"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
            <HardHat size={22} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-navy-900">Supervisor</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
              Submit site progress through Text or Excel. AI maps updates to the correct schedule activity.
            </p>
          </div>
          <span className="mt-auto flex items-center gap-1.5 text-sm font-medium text-teal-600">
            Enter as Supervisor
            <ArrowRight size={15} className="transition group-hover:translate-x-0.5" />
          </span>
        </Link>
      </section>

      <footer className="border-t border-slate-100 py-6 text-center text-xs text-slate-400">
        Current prototype supports Text and Excel inputs. Voice transcription and scanned-diary OCR are planned for a future release.
      </footer>
    </div>
  );
}
