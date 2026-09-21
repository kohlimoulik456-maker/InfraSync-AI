import { NextRequest, NextResponse } from "next/server";
import {
  getProjectHealthOverview,
  getPlannedVsActual,
  getActivityStatusAnalysis,
  getDisciplinePerformance,
  getAiConfidenceAnalysis,
  getDelayVarianceAnalysis,
  getCriticalAtRiskActivities,
  getSupervisorReportingAnalysis,
  getInstitutionalMemorySnapshot,
  getFundTracing,
  DashboardFilters
} from "@/lib/services/dashboardAnalyticsService";

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  const { searchParams } = new URL(req.url);
  const filters: DashboardFilters = {
    discipline: searchParams.get("discipline") || undefined,
    area: searchParams.get("area") || undefined,
    contractor: searchParams.get("contractor") || undefined,
    activityStatus: searchParams.get("activityStatus") || undefined
  };

  const [health, plannedVsActual, statusAnalysis, disciplinePerf, aiConfidence, delayVariance, criticalRisk, reporting, institutionalMemory, fundTracing] =
    await Promise.all([
      getProjectHealthOverview(params.projectId, filters),
      getPlannedVsActual(params.projectId),
      getActivityStatusAnalysis(params.projectId, filters),
      getDisciplinePerformance(params.projectId),
      getAiConfidenceAnalysis(params.projectId),
      getDelayVarianceAnalysis(params.projectId),
      getCriticalAtRiskActivities(params.projectId),
      getSupervisorReportingAnalysis(params.projectId),
      getInstitutionalMemorySnapshot(params.projectId),
      getFundTracing(params.projectId)
    ]);

  return NextResponse.json({
    health,
    plannedVsActual,
    statusAnalysis,
    disciplinePerf,
    aiConfidence,
    delayVariance,
    criticalRisk,
    reporting,
    institutionalMemory,
    fundTracing
  });
}
