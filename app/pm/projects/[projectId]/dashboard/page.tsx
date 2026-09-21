"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { PmShell } from "@/components/PmShell";
import { StatusChip } from "@/components/StatusChip";
import { formatDate, formatPct } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
  Area,
  AreaChart
} from "recharts";
import { 
  AlertTriangle, 
  BookOpen, 
  TrendingUp, 
  TrendingDown, 
  Activity,
  CheckCircle2,
  Clock,
  AlertCircle,
  Pause,
  Flag,
  Users,
  Calendar,
  Target,
  Zap,
  RefreshCw,
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: "#12866F",
  IN_PROGRESS: "#C97A0C",
  DELAYED: "#B4232C",
  NOT_STARTED: "#94A0AE"
};

export default function ProjectDashboardPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const [data, setData] = useState<any>(null);
  const [filters, setFilters] = useState<{ discipline?: string; area?: string; contractor?: string; activityStatus?: string }>({});
  const [meta, setMeta] = useState<{ disciplines: string[]; areas: string[]; contractors: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "funds">("funds");

  const load = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams();
    if (filters.discipline) q.set("discipline", filters.discipline);
    if (filters.area) q.set("area", filters.area);
    if (filters.contractor) q.set("contractor", filters.contractor);
    if (filters.activityStatus) q.set("activityStatus", filters.activityStatus);

    const [dashRes, projRes] = await Promise.all([
      fetch(`/api/dashboard/${projectId}?${q.toString()}`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}`).then((r) => r.json())
    ]);
    setData(dashRes);
    setMeta({ disciplines: projRes.disciplines ?? [], areas: projRes.areas ?? [], contractors: projRes.contractors ?? [] });
    setLastLoadedAt(new Date());
    setLoading(false);
  }, [projectId, filters]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !data) {
    return (
      <PmShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 animate-spin rounded-full border-4 border-slate-200 border-t-navy-600"></div>
            <p className="text-sm font-medium text-slate-600">Loading dashboard data...</p>
            <p className="mt-1 text-xs text-slate-400">Analyzing {projectId.slice(0, 8)}...</p>
          </div>
        </div>
      </PmShell>
    );
  }

  const { health, plannedVsActual, statusAnalysis, disciplinePerf, aiConfidence, delayVariance, criticalRisk, reporting, institutionalMemory, fundTracing } =
    data;

  const pieData = Object.entries(statusAnalysis.byStatus).map(([name, value]) => ({ name, value }));
  const disciplineChartData = disciplinePerf.map((d: any) => ({ name: d.discipline, Progress: d.progressPct }));
  const decisionChartData = Object.entries(aiConfidence.byDecision).map(([name, value]) => ({ name, value }));
  const delayByDiscipline = Object.entries(delayVariance.delayDaysByDiscipline).map(([name, value]) => ({ name, value }));
  const delayReasons = Object.entries(delayVariance.delayReasonDistribution).map(([name, value]) => ({ name, value }));

  return (
    <PmShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <div className="rounded-lg bg-navy-100 p-2">
              <Activity className="text-navy-700" size={20} />
            </div>
            <p className="font-mono text-xs font-medium text-slate-400">{projectId.slice(0, 13)}...</p>
          </div>
          <h1 className="text-3xl font-bold text-navy-900">Project Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Real-time insights across {health.totalActivities} tracked activities
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <button onClick={load} disabled={loading} className="btn-secondary text-xs" title="Refresh dashboard data">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <FilterBar meta={meta} filters={filters} setFilters={setFilters} />
        </div>
      </div>
      {lastLoadedAt && <p className="-mt-4 mb-5 text-right text-[11px] text-slate-400">Updated {lastLoadedAt.toLocaleTimeString()}</p>}

      <div className="mb-7 flex gap-1 border-b border-slate-200" role="tablist" aria-label="Dashboard views">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "overview"}
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
            activeTab === "overview" ? "border-navy-700 text-navy-900" : "border-transparent text-slate-500 hover:text-navy-700"
          }`}
        >
          <Activity size={16} />
          Project Overview
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "funds"}
          onClick={() => setActiveTab("funds")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
            activeTab === "funds" ? "border-teal-600 text-teal-700" : "border-transparent text-slate-500 hover:text-teal-700"
          }`}
        >
          <Wallet size={16} />
          Fund Tracing
        </button>
      </div>

      {activeTab === "funds" ? (
        <FundTracing fundTracing={fundTracing} />
      ) : (
        <>

      {/* 1. Project Health Overview */}
      <SectionTitle 
        title="Project Health Overview" 
        subtitle={`Last updated: ${health.lastSupervisorUpdate ? formatDate(health.lastSupervisorUpdate) : 'No updates yet'}`}
      />
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <StatCard 
          label="Overall Progress" 
          value={formatPct(health.overallProgressPct)} 
          icon={<Target size={18} />}
          tone="navy"
        />
        <StatCard 
          label="Completed" 
          value={health.completedActivities} 
          icon={<CheckCircle2 size={18} />}
          tone="teal" 
        />
        <StatCard 
          label="In Progress" 
          value={health.inProgressActivities} 
          icon={<Activity size={18} />}
          tone="amber" 
        />
        <StatCard 
          label="Delayed" 
          value={health.delayedActivities} 
          icon={<AlertCircle size={18} />}
          tone="danger" 
        />
        <StatCard 
          label="Not Started" 
          value={health.notStartedActivities}
          icon={<Pause size={18} />}
        />
        <StatCard 
          label="Pending Audits" 
          value={health.pendingAiAudits} 
          icon={<Flag size={18} />}
          tone="amber" 
        />
        <StatCard 
          label="Sched. Variance" 
          value={health.scheduleVarianceActivities} 
          icon={<Clock size={18} />}
          tone="danger" 
        />
      </div>

      {/* 2. Planned vs Actual */}
      <SectionTitle 
        title="Planned vs Actual Progress" 
        subtitle="Comparing time-based schedule expectations with verified field completion"
      />
      <div className="card mb-8 p-6">
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-4">
            <Calendar className="text-slate-400" size={24} />
            <div>
              <p className="text-xs text-slate-500">Planned Cumulative Completion</p>
              <p className="text-2xl font-semibold text-navy-900">{formatPct(plannedVsActual.plannedCompletionPct)}</p>
              <p className="text-xs text-slate-400">Based on schedule dates</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-teal-50 p-4">
            <CheckCircle2 className="text-teal-600" size={24} />
            <div>
              <p className="text-xs text-slate-500">Verified Actual Completion</p>
              <p className="text-2xl font-semibold text-teal-700">{formatPct(plannedVsActual.actualCompletionPct)}</p>
              <p className="text-xs text-slate-400">Confirmed by field teams</p>
            </div>
          </div>
        </div>
        
        <div className="space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-slate-600">
                <div className="h-3 w-3 rounded bg-slate-400"></div>
                Planned progress (time-based)
              </span>
              <span className="font-semibold text-navy-900">{formatPct(plannedVsActual.plannedCompletionPct)}</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-slate-400 transition-all duration-500" style={{ width: `${plannedVsActual.plannedCompletionPct}%` }} />
            </div>
          </div>
          
          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-slate-600">
                <div className="h-3 w-3 rounded bg-teal-500"></div>
                Actual verified completion
              </span>
              <span className="font-semibold text-teal-700">{formatPct(plannedVsActual.actualCompletionPct)}</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-teal-50">
              <div className="h-full rounded-full bg-teal-500 transition-all duration-500" style={{ width: `${plannedVsActual.actualCompletionPct}%` }} />
            </div>
          </div>
        </div>

        {plannedVsActual.actualCompletionPct < plannedVsActual.plannedCompletionPct && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs">
            <TrendingDown size={16} className="mt-0.5 shrink-0 text-amber-600" />
            <p className="text-amber-900">
              Project is <strong>{(plannedVsActual.plannedCompletionPct - plannedVsActual.actualCompletionPct).toFixed(1)}%</strong> behind schedule. 
              Consider resource reallocation or acceleration strategies.
            </p>
          </div>
        )}
        
        {plannedVsActual.actualCompletionPct >= plannedVsActual.plannedCompletionPct && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-teal-200 bg-teal-50 p-3 text-xs">
            <TrendingUp size={16} className="mt-0.5 shrink-0 text-teal-600" />
            <p className="text-teal-900">
              Project is on track or ahead of schedule! Actual completion matches or exceeds planned progress.
            </p>
          </div>
        )}
      </div>

      {/* 3. Activity Status Analysis */}
      <SectionTitle 
        title="Activity Status Analysis" 
        subtitle={`${statusAnalysis.rows.length} activities tracked across all disciplines`}
      />
      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">Status Distribution</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie 
                data={pieData} 
                dataKey="value" 
                nameKey="name" 
                innerRadius={50} 
                outerRadius={80}
                paddingAngle={2}
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={STATUS_COLORS[entry.name] || "#94A0AE"} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }}
              />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                formatter={(value) => <span className="text-xs">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="card overflow-hidden p-0 lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gradient-to-r from-slate-50 to-slate-100 text-slate-600">
                <tr>
                  <th className="px-3 py-3 font-medium">Activity</th>
                  <th className="px-3 py-3 font-medium">Discipline</th>
                  <th className="px-3 py-3 font-medium">Planned Finish</th>
                  <th className="px-3 py-3 font-medium">Actual Finish</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Delay (d)</th>
                  <th className="px-3 py-3 font-medium">AI Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {statusAnalysis.rows.slice(0, 12).map((r: any) => (
                  <tr key={r.activityId} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-3">
                      <p className="font-medium text-navy-900">{r.activityName}</p>
                      <p className="font-mono text-[10px] text-slate-400">{r.activityId.slice(0, 8)}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                        {r.discipline}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-600">{formatDate(r.plannedFinish)}</td>
                    <td className="px-3 py-3 text-slate-600">{formatDate(r.actualFinish)}</td>
                    <td className="px-3 py-3">
                      <StatusChip value={r.status} />
                    </td>
                    <td className="px-3 py-3">
                      {r.delayDays ? (
                        <span className="font-semibold text-danger-600">{r.delayDays}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {r.latestConfidence != null ? (
                        <span className={`font-medium ${
                          r.latestConfidence >= 80 ? 'text-teal-600' : 
                          r.latestConfidence >= 60 ? 'text-amber-600' : 
                          'text-danger-600'
                        }`}>
                          {r.latestConfidence}%
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 4. Discipline-wise Performance */}
      <SectionTitle 
        title="Discipline-wise Performance" 
        subtitle="Progress and activity tracking across engineering disciplines"
      />
      <div className="card mb-8 p-5">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={disciplineChartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E7E9ED" />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 11, fill: '#64748b' }} 
              tickLine={false}
              axisLine={{ stroke: '#E7E9ED' }}
            />
            <YAxis 
              tick={{ fontSize: 11, fill: '#64748b' }} 
              unit="%" 
              tickLine={false}
              axisLine={false}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#fff', 
                border: '1px solid #e2e8f0', 
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
              }}
              labelStyle={{ fontWeight: 600, color: '#0f172a' }}
            />
            <Bar 
              dataKey="Progress" 
              fill="#0F2A4A" 
              radius={[6, 6, 0, 0]}
              maxBarSize={60}
            />
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {disciplinePerf.map((d: any) => (
            <div key={d.discipline} className="group relative overflow-hidden rounded-lg border border-slate-100 bg-gradient-to-br from-slate-50 to-white p-3 transition-all hover:border-slate-200 hover:shadow-md">
              <p className="mb-2 text-xs font-semibold text-navy-900">{d.discipline}</p>
              <div className="space-y-1 text-[11px] text-slate-600">
                <div className="flex items-center justify-between">
                  <span>Progress</span>
                  <span className="font-semibold text-navy-900">{d.progressPct}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Updates</span>
                  <span className="font-medium">{d.updateCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Pending</span>
                  <span className={`font-medium ${d.pendingAudits > 0 ? 'text-amber-600' : 'text-teal-600'}`}>
                    {d.pendingAudits}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Avg Conf.</span>
                  <span className={`font-medium ${
                    d.avgConfidence >= 80 ? 'text-teal-600' : 
                    d.avgConfidence >= 60 ? 'text-amber-600' : 
                    'text-slate-400'
                  }`}>
                    {d.avgConfidence != null ? `${d.avgConfidence}%` : "—"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. AI Confidence & Audit Analysis */}
      <SectionTitle 
        title="AI Confidence & Audit Analysis" 
        subtitle="Automated matching quality and human review requirements"
      />
      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">Decision Distribution</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={decisionChartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E7E9ED" />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 10, fill: '#64748b' }} 
                tickLine={false}
                angle={-15}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                tick={{ fontSize: 11, fill: '#64748b' }} 
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
              />
              <Bar 
                dataKey="value" 
                fill="#12866F" 
                radius={[6, 6, 0, 0]}
                maxBarSize={80}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card flex flex-col justify-center gap-4 p-5">
          <div className="rounded-lg border border-slate-100 bg-gradient-to-br from-teal-50 to-emerald-50 p-4 text-center">
            <Zap className="mx-auto mb-2 text-teal-600" size={24} />
            <p className="text-xs text-slate-600">Average Confidence</p>
            <p className="mt-1 text-3xl font-bold text-teal-700">
              {aiConfidence.avgConfidence != null ? `${aiConfidence.avgConfidence}%` : "—"}
            </p>
            <p className="mt-1 text-[10px] text-slate-500">40% semantic + 25% schedule + 20% context + 15% rules</p>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Confidence Bands</p>
            <div className="space-y-2 text-xs">
              {aiConfidence.distribution.map((b: any) => (
                <div key={b.label} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="text-slate-600">{b.label}%</span>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
                      <div 
                        className={`h-full rounded-full ${
                          parseInt(b.label.split('-')[0]) >= 80 ? 'bg-teal-500' : 
                          parseInt(b.label.split('-')[0]) >= 60 ? 'bg-amber-500' : 
                          'bg-slate-400'
                        }`}
                        style={{ width: `${Math.min(100, (b.count / Math.max(...aiConfidence.distribution.map((x: any) => x.count))) * 100)}%` }}
                      />
                    </div>
                    <span className="w-8 text-right font-semibold text-navy-900">{b.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(aiConfidence.byCriterion ?? []).map((c: any) => (
          <div key={c.key} className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-slate-500">{c.label}</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-400">{c.weight}% of overall</p>
              </div>
              <p className="text-xl font-bold text-navy-900">{c.value != null ? `${c.value}%` : "—"}</p>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${
                  (c.value ?? 0) >= 80 ? "bg-teal-500" : (c.value ?? 0) >= 60 ? "bg-amber-500" : "bg-slate-400"
                }`}
                style={{ width: `${c.value ?? 0}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Contribution {c.value != null ? ((c.value * c.weight) / 100).toFixed(1) : "—"} pts
            </p>
          </div>
        ))}
      </div>

      {/* 6. Delay & Variance Analysis */}
      <SectionTitle 
        title="Delay & Variance Analysis" 
        subtitle="Root cause analysis of schedule slippage"
      />
      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3 rounded-lg bg-danger-50 p-3">
              <AlertCircle className="text-danger-600" size={20} />
              <div>
                <p className="text-xs text-slate-500">Delayed Activities</p>
                <p className="text-xl font-bold text-danger-600">{delayVariance.delayedActivitiesCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
              <Clock className="text-slate-600" size={20} />
              <div>
                <p className="text-xs text-slate-500">Total Delay Days</p>
                <p className="text-xl font-bold text-navy-900">{delayVariance.totalDelayDays}</p>
              </div>
            </div>
          </div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Delay Days by Discipline</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={delayByDiscipline}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E7E9ED" />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickLine={false}
                angle={-15}
                textAnchor="end"
                height={50}
              />
              <YAxis 
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
              />
              <Bar 
                dataKey="value" 
                fill="#B4232C" 
                radius={[4, 4, 0, 0]}
                maxBarSize={50}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">Delay Reason Distribution</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={delayReasons} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E7E9ED" />
              <XAxis 
                type="number" 
                allowDecimals={false} 
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickLine={false}
              />
              <YAxis 
                dataKey="name" 
                type="category" 
                width={110} 
                tick={{ fontSize: 11, fill: '#334155' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
              />
              <Bar 
                dataKey="value" 
                fill="#C97A0C" 
                radius={[0, 4, 4, 0]}
                maxBarSize={32}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 7. Critical / At-Risk Analysis */}
      <SectionTitle 
        title="Critical / At-Risk Activities" 
        subtitle="Rule-based flagging system for activities requiring immediate attention"
      />
      <div className="card mb-8 divide-y divide-slate-100 p-0">
        {criticalRisk.length === 0 && (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <CheckCircle2 size={32} className="text-teal-500" />
            <p className="text-sm font-medium text-slate-600">No at-risk activities flagged</p>
            <p className="text-xs text-slate-400">All activities are on track or within acceptable variance</p>
          </div>
        )}
        {criticalRisk.slice(0, 10).map((r: any, idx: number) => (
          <div key={r.activityId} className="group flex items-start gap-4 p-4 transition-colors hover:bg-amber-50">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700 group-hover:bg-amber-200">
              {idx + 1}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-navy-900">
                {r.activityName}
              </p>
              <p className="mt-0.5 font-mono text-xs text-slate-400">{r.activityId.slice(0, 8)}...</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {r.flags.map((flag: string, i: number) => (
                  <span 
                    key={i} 
                    className="inline-flex items-center gap-1 rounded-full bg-white border border-amber-200 px-2.5 py-1 text-xs text-amber-900"
                  >
                    <AlertTriangle size={12} className="text-amber-600" />
                    {flag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 8. Supervisor Reporting Analysis */}
      <SectionTitle 
        title="Supervisor Reporting Analysis" 
        subtitle="Field update activity and reporting coverage"
      />
      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-3">
            <Users className="text-navy-600" size={24} />
            <div>
              <p className="text-xs text-slate-500">Total Updates</p>
              <p className="text-2xl font-bold text-navy-900">{reporting.totalUpdates}</p>
            </div>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2">
              <span className="text-slate-600">Pending</span>
              <span className="font-semibold text-amber-700">{reporting.pendingUpdates}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-danger-50 px-3 py-2">
              <span className="text-slate-600">Invalid</span>
              <span className="font-semibold text-danger-600">{reporting.invalidUpdates}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-teal-50 px-3 py-2">
              <span className="text-slate-600">Processed</span>
              <span className="font-semibold text-teal-700">
                {reporting.totalUpdates - reporting.pendingUpdates - reporting.invalidUpdates}
              </span>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            <Users size={14} />
            By Supervisor
          </p>
          <div className="space-y-1.5 text-xs">
            {Object.entries(reporting.bySupervisor).slice(0, 8).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 transition-colors hover:bg-slate-100">
                <span className="font-mono text-slate-700">{k}</span>
                <span className="font-semibold text-navy-900">{v as number}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            <Activity size={14} />
            Latest Updates
          </p>
          <div className="space-y-2.5 text-xs">
            {reporting.latestFeed.slice(0, 5).map((u: any) => (
              <div key={u.updateId} className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 transition-colors hover:bg-white">
                <p className="font-medium leading-snug text-navy-900">{u.activityDescription.slice(0, 60)}...</p>
                <p className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
                  <span className="font-mono font-medium text-slate-600">{u.supervisorId}</span>
                  <span>·</span>
                  <span>{formatDate(u.createdAt)}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 9. Institutional Memory snapshot */}
      <SectionTitle 
        title="Institutional Memory & Historical Insights" 
        subtitle="Learn from verified project history to improve future performance"
      />
      <div className="card mb-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-100">
                <CheckCircle2 className="text-teal-600" size={24} />
              </div>
              <div>
                <p className="text-xs text-slate-500">Verified Records</p>
                <p className="text-2xl font-bold text-navy-900">{institutionalMemory.verifiedRecordCount}</p>
                <p className="text-xs text-slate-400">Activity actuals</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
                <BookOpen className="text-amber-600" size={24} />
              </div>
              <div>
                <p className="text-xs text-slate-500">Approved Lessons</p>
                <p className="text-2xl font-bold text-navy-900">{institutionalMemory.lessonCount}</p>
                <p className="text-xs text-slate-400">Manager-approved insights</p>
              </div>
            </div>
          </div>
          <a 
            href="/pm/institutional-memory" 
            className="btn-primary group flex items-center gap-2 text-sm"
          >
            <BookOpen size={16} />
            <span>Explore Memory</span>
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </a>
        </div>
      </div>
        </>
      )}
    </PmShell>
  );
}

function FundTracing({ fundTracing }: { fundTracing: any }) {
  const formatCurrency = (amount: number) => `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  const usagePct = fundTracing.received > 0 ? Math.min(100, (fundTracing.used / fundTracing.received) * 100) : 0;

  return (
    <div>
      <SectionTitle title="Fund Tracing" subtitle={`Verified project cash position${fundTracing.asOf ? ` through ${formatDate(fundTracing.asOf)}` : ""}`} />
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Payment Received" value={formatCurrency(fundTracing.received)} icon={<ArrowDownToLine size={18} />} tone="teal" />
        <StatCard label="Payment Used" value={formatCurrency(fundTracing.used)} icon={<ArrowUpFromLine size={18} />} tone="amber" />
        <StatCard label="Fund Remaining" value={formatCurrency(fundTracing.remaining)} icon={<Wallet size={18} />} tone="navy" />
      </div>
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-2">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Fund position</p><p className="mt-1 text-3xl font-bold text-navy-900">{formatCurrency(fundTracing.remaining)}</p></div>
            <div className="rounded-lg bg-teal-50 p-3 text-teal-600"><Wallet size={22} /></div>
          </div>
          <div className="mb-2 flex items-center justify-between text-xs text-slate-600"><span>{formatCurrency(fundTracing.used)} used</span><span>{usagePct.toFixed(1)}% of receipts</span></div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${usagePct}%` }} /></div>
          <p className="mt-3 text-xs text-slate-500">Remaining balance is calculated from every recorded receipt less every recorded expenditure.</p>
        </div>
        <div className="card flex flex-col justify-between p-6">
          <div><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Fund custodian</p><p className="mt-2 text-lg font-semibold text-navy-900">{fundTracing.manager}</p><p className="mt-1 text-xs text-slate-500">Current balance manager</p></div>
          <div className="mt-6 rounded-lg bg-slate-50 p-3 text-xs text-slate-600"><span className="font-semibold text-navy-900">{fundTracing.transactions.length}</span> ledger entries tracked</div>
        </div>
      </div>
      <div className="card overflow-hidden p-0">
        <div className="border-b border-slate-100 px-5 py-4"><h3 className="text-sm font-semibold text-navy-900">Payment and expenditure ledger</h3><p className="mt-1 text-xs text-slate-500">Chronological trace of funds received and used on this project</p></div>
        {fundTracing.transactions.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">No fund transactions recorded yet.</div> : (
          <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-5 py-3 font-medium">Date</th><th className="px-5 py-3 font-medium">Entry</th><th className="px-5 py-3 font-medium">Category</th><th className="px-5 py-3 font-medium">Manager</th><th className="px-5 py-3 text-right font-medium">Amount</th></tr></thead><tbody className="divide-y divide-slate-100">
            {fundTracing.transactions.map((transaction: any) => { const isReceipt = transaction.transactionType === "RECEIPT"; return <tr key={transaction.transactionId} className="hover:bg-slate-50"><td className="whitespace-nowrap px-5 py-3 text-slate-600">{formatDate(transaction.transactionDate)}</td><td className="px-5 py-3"><div className="flex items-center gap-2"><span className={`flex h-7 w-7 items-center justify-center rounded-full ${isReceipt ? "bg-teal-50 text-teal-600" : "bg-amber-50 text-amber-600"}`}>{isReceipt ? <ArrowDownToLine size={14} /> : <ArrowUpFromLine size={14} />}</span><div><p className="font-medium text-navy-900">{transaction.description}</p><p className="text-[10px] uppercase tracking-wide text-slate-400">{isReceipt ? "Payment received" : "Payment used"}</p></div></div></td><td className="px-5 py-3 text-slate-600">{transaction.category}</td><td className="px-5 py-3 text-slate-600">{transaction.manager}</td><td className={`whitespace-nowrap px-5 py-3 text-right font-semibold ${isReceipt ? "text-teal-700" : "text-amber-700"}`}>{isReceipt ? "+" : "-"}{formatCurrency(transaction.amount)}</td></tr>; })}
          </tbody></table></div>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3 mt-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
    </div>
  );
}

function StatCard({ 
  label, 
  value, 
  tone,
  icon 
}: { 
  label: string; 
  value: string | number; 
  tone?: "teal" | "amber" | "danger" | "navy";
  icon?: React.ReactNode;
}) {
  const toneClass = 
    tone === "teal" ? "text-teal-600 bg-teal-50 border-teal-100" : 
    tone === "amber" ? "text-amber-600 bg-amber-50 border-amber-100" : 
    tone === "danger" ? "text-danger-600 bg-danger-50 border-danger-100" : 
    tone === "navy" ? "text-navy-700 bg-navy-50 border-navy-100" :
    "text-navy-900 bg-white border-slate-100";
    
  const iconColor = 
    tone === "teal" ? "text-teal-500" : 
    tone === "amber" ? "text-amber-500" : 
    tone === "danger" ? "text-danger-500" : 
    tone === "navy" ? "text-navy-600" :
    "text-slate-400";

  return (
    <div className={`card border p-4 transition-all hover:shadow-md ${toneClass}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs text-slate-500">{label}</p>
          <p className={`mt-1.5 text-2xl font-bold ${
            tone === "teal" ? "text-teal-700" : 
            tone === "amber" ? "text-amber-700" : 
            tone === "danger" ? "text-danger-600" : 
            tone === "navy" ? "text-navy-800" :
            "text-navy-900"
          }`}>
            {value}
          </p>
        </div>
        {icon && (
          <div className={`rounded-lg p-2 ${iconColor}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterBar({
  meta,
  filters,
  setFilters
}: {
  meta: { disciplines: string[]; areas: string[]; contractors: string[] } | null;
  filters: any;
  setFilters: (f: any) => void;
}) {
  if (!meta) return null;
  return (
    <div className="flex flex-wrap gap-2">
      <select
        className="input-field w-auto text-xs"
        value={filters.discipline ?? ""}
        onChange={(e) => setFilters({ ...filters, discipline: e.target.value || undefined })}
      >
        <option value="">All Disciplines</option>
        {meta.disciplines.map((d) => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>
      <select
        className="input-field w-auto text-xs"
        value={filters.area ?? ""}
        onChange={(e) => setFilters({ ...filters, area: e.target.value || undefined })}
      >
        <option value="">All Areas</option>
        {meta.areas.map((a) => (
          <option key={a} value={a}>{a}</option>
        ))}
      </select>
      <select
        className="input-field w-auto text-xs"
        value={filters.activityStatus ?? ""}
        onChange={(e) => setFilters({ ...filters, activityStatus: e.target.value || undefined })}
      >
        <option value="">All Statuses</option>
        <option value="NOT_STARTED">Not Started</option>
        <option value="IN_PROGRESS">In Progress</option>
        <option value="COMPLETED">Completed</option>
        <option value="DELAYED">Delayed</option>
      </select>
    </div>
  );
}
