import { prisma } from "../prisma";
import { CandidateActivity, LlmExtraction } from "../types";
import { tokenSimilarity } from "./confidenceService";

/**
 * Critical rule: AI matching must search only activities where
 * schedule_activities.project_id = supervisor_updates.project_id.
 * Returns exactly the top 3 ranked candidates.
 */
export async function retrieveTopCandidates(
  projectId: string,
  extraction: LlmExtraction
): Promise<CandidateActivity[]> {
  const activities = await prisma.scheduleActivity.findMany({
    where: { projectId }
  });

  if (activities.length === 0) return [];

  const extractedText = [
    extraction.activity_text.value,
    extraction.asset_tag.value,
    extraction.discipline.value,
    extraction.area_location.value
  ]
    .filter(Boolean)
    .join(" ");

  const extractedDiscipline = (extraction.discipline.value || "").toUpperCase().trim();
  const extractedArea = (extraction.area_location.value || "").toLowerCase().trim();

  const ranked = activities
    .map((a) => {
      const candidate: CandidateActivity = {
        activity_id: a.activityId,
        activity_name: a.activityName,
        discipline: a.discipline,
        area: a.area,
        activity_status: a.activityStatus,
        field_keywords: a.fieldKeywords,
        normalized_search_text: a.normalizedSearchText,
        planned_start: a.plannedStart.toISOString(),
        planned_finish: a.plannedFinish.toISOString(),
        predecessor_id: a.predecessorId
      };

      let baseScore = tokenSimilarity(
        extractedText,
        [candidate.activity_name, candidate.field_keywords ?? "", candidate.normalized_search_text].join(
          " "
        )
      );

      // Soft preference boosts for matching discipline / area, so that
      // same-discipline / same-area activities surface into the top 3
      // even when text similarity alone is close between candidates.
      if (extractedDiscipline && candidate.discipline.toUpperCase() === extractedDiscipline) {
        baseScore += 8;
      }
      if (extractedArea && (candidate.area || "").toLowerCase() === extractedArea) {
        baseScore += 5;
      }

      return { candidate, score: Math.min(100, baseScore) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return ranked.map((r) => r.candidate);
}
