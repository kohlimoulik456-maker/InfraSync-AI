import { prisma } from "../prisma";
import { NormalizedSupervisorInput, PipelineResult, ScoredCandidate } from "../types";
import { runExtraction, runReranking } from "./aiExtractionService";
import { retrieveTopCandidates } from "./candidateRetrievalService";
import {
  buildConfidenceBreakdown,
  contextMatch,
  ruleValidation,
  scheduleConsistency,
  semanticSimilarity,
  topTwoGap,
  decisionFromScore
} from "./confidenceService";
import { buildAuditJson, persistMatch } from "./auditService";
import { applyVerifiedActual } from "./activityActualsService";

const AMBIGUITY_GAP_THRESHOLD = 10;

/**
 * Runs one normalized supervisor input (one text update, or one Excel row)
 * through the full common AI pipeline (spec section 11) and persists the
 * supervisor_updates + ai_activity_matches records, applying schedule
 * actuals automatically only when eligible.
 */
export async function runPipelineForInput(input: NormalizedSupervisorInput): Promise<{
  updateId: string;
  result: PipelineResult;
}> {
  // Step 0: persist the raw supervisor_updates record first, always.
  const update = await prisma.supervisorUpdate.create({
    data: {
      projectId: input.project_id,
      supervisorId: input.supervisor_id,
      updateDate: new Date(input.update_date),
      sourceType: input.source_type as any,
      areaUnit: input.area_unit ?? undefined,
      discipline: input.discipline ?? undefined,
      activityDescription: input.activity_description,
      actualStartDate: input.actual_start_date ? new Date(input.actual_start_date) : undefined,
      actualFinishDate: input.actual_finish_date ? new Date(input.actual_finish_date) : undefined,
      progressValue: input.progress_value ?? undefined,
      progressUnit: input.progress_unit ?? undefined,
      delayReason: input.delay_reason ?? undefined,
      remarks: input.remarks ?? undefined,
      rawInput: input.raw_input
    }
  });

  const project = await prisma.project.findUnique({ where: { projectId: input.project_id } });
  const projectIdValid = !!project;

  // Step 2: Gemini extracts structured event data.
  const { extraction, failed: extractionFailed } = await runExtraction(
    input.raw_input,
    input.update_date
  );

  if (extractionFailed || !extraction) {
    const confidence = buildConfidenceBreakdown(0, 0, 0, 0, null);
    const auditJson = buildAuditJson({
      activityId: null,
      activityName: null,
      mappingStatus: "INVALID",
      candidates: [],
      confidence,
      action: "REJECTED",
      requiresHumanReview: true,
      reason: "LLM structured extraction failed validation.",
      sourceEvidence: []
    });
    await persistMatch({
      updateId: update.updateId,
      activityId: null,
      matchStatus: "INVALID",
      confidence,
      decision: "REJECTED",
      reason: "LLM structured extraction failed validation.",
      candidates: [] as any,
      scoredCandidates: [],
      llmExtraction: null,
      auditJson
    });
    return {
      updateId: update.updateId,
      result: {
        matchStatus: "INVALID",
        decision: "REJECTED",
        activityId: null,
        activityName: null,
        reason: "LLM structured extraction failed validation.",
        confidence,
        candidates: [],
        llmExtraction: null,
        auditJson
      }
    };
  }

  // Step 3: retrieve top 3 candidates from the same Project_ID only.
  const candidates = await retrieveTopCandidates(input.project_id, extraction);

  if (candidates.length === 0) {
    const confidence = buildConfidenceBreakdown(0, 0, 0, projectIdValid ? 100 : 0, null);
    const reason = projectIdValid
      ? "No schedule activities exist for this project to match against."
      : "Project_ID is invalid.";
    const auditJson = buildAuditJson({
      activityId: null,
      activityName: null,
      mappingStatus: "UNMATCHED",
      candidates: [],
      confidence,
      action: "NO_MATCH",
      requiresHumanReview: true,
      reason,
      sourceEvidence: []
    });
    await persistMatch({
      updateId: update.updateId,
      activityId: null,
      matchStatus: "UNMATCHED",
      confidence,
      decision: "NO_MATCH",
      reason,
      candidates: [] as any,
      scoredCandidates: [],
      llmExtraction: extraction,
      auditJson
    });
    return {
      updateId: update.updateId,
      result: {
        matchStatus: "UNMATCHED",
        decision: "NO_MATCH",
        activityId: null,
        activityName: null,
        reason,
        confidence,
        candidates: [],
        llmExtraction: extraction,
        auditJson
      }
    };
  }

  // Step 4: Gemini reranks the top 3 candidates.
  const { rerank } = await runReranking(extraction, candidates);

  // Step 5: backend computes mathematical confidence per candidate.
  const scored: ScoredCandidate[] = candidates.map((c) => {
    const semantic = semanticSimilarity(extraction.activity_text.value || "", c);
    return { activity_id: c.activity_id, activity_name: c.activity_name, similarity: semantic };
  });
  scored.sort((a, b) => b.similarity - a.similarity);

  const topCandidateMeta = candidates.find((c) => c.activity_id === scored[0].activity_id)!;
  const semantic = scored[0].similarity;
  const schedule = scheduleConsistency(extraction, topCandidateMeta, !!input.actual_start_date);
  const context = contextMatch(extraction, topCandidateMeta);

  const explicitDiscipline = (extraction.discipline.value || "").toUpperCase().trim();
  const candidateDiscipline = topCandidateMeta.discipline.toUpperCase().trim();
  const disciplineConflict = !!explicitDiscipline && explicitDiscipline !== candidateDiscipline;

  const rule = ruleValidation({
    activityBelongsToProject: topCandidateMeta && project ? true : false,
    projectIdValid,
    rawInputExists: !!input.raw_input && input.raw_input.trim().length > 0,
    datesValid: true,
    finishNotBeforeStart: !(
      extraction.actual_start.value &&
      extraction.actual_finish.value &&
      new Date(extraction.actual_finish.value) < new Date(extraction.actual_start.value)
    ),
    workStatusValid: true,
    hasProhibitedConflict: disciplineConflict
  });

  const gap = topTwoGap(scored);
  const confidence = buildConfidenceBreakdown(semantic, schedule, context, rule, gap);

  let { matchStatus, decision } = decisionFromScore(confidence.overall_score) as {
    matchStatus: PipelineResult["matchStatus"];
    decision: PipelineResult["decision"];
  };
  let reason = `Overall confidence ${confidence.overall_score}% based on semantic, schedule, context and rule validation scoring.`;
  let selectedActivityId: string | null = topCandidateMeta.activity_id;
  let selectedActivityName: string | null = topCandidateMeta.activity_name;
  let requiresReview = decision !== "AUTO_ACCEPT" && decision !== "ACCEPT_MONITOR";

  // Critical invalid conditions take priority.
  if (rule === 0) {
    matchStatus = "INVALID";
    decision = "REJECTED";
    selectedActivityId = null;
    selectedActivityName = null;
    requiresReview = true;
    reason = disciplineConflict
      ? "Explicit discipline conflict between the supervisor update and the top candidate activity."
      : "Critical rule validation failure (invalid project or missing input).";
  } else if (gap !== null && gap < AMBIGUITY_GAP_THRESHOLD) {
    // Ambiguity guard: top two candidates too close together.
    matchStatus = "AMBIGUOUS";
    decision = "FLAG_FOR_REVIEW";
    requiresReview = true;
    reason =
      "Multiple activities have similar semantic matches and the supervisor update lacks sufficient location/work-type specificity.";
  } else if (rerank && rerank.selected_candidate_id === null) {
    // Gemini found evidence insufficient - never let similarity alone override this.
    if (matchStatus === "MATCHED") {
      matchStatus = "AMBIGUOUS";
      decision = "FLAG_FOR_REVIEW";
      requiresReview = true;
    }
    reason = rerank.candidate_reason || "LLM reranking found insufficient evidence to confirm the match.";
  } else if (matchStatus === "UNMATCHED") {
    selectedActivityId = null;
    selectedActivityName = null;
    requiresReview = true;
  }

  if (matchStatus !== "MATCHED") {
    // Only populate activity fields for confirmed matches.
    if (matchStatus === "AMBIGUOUS" || matchStatus === "UNMATCHED" || matchStatus === "INVALID") {
      selectedActivityId = null;
      selectedActivityName = null;
    }
  }

  const auditJson = buildAuditJson({
    activityId: selectedActivityId,
    activityName: selectedActivityName,
    mappingStatus: matchStatus,
    candidates: scored,
    confidence,
    action: decision,
    requiresHumanReview: requiresReview,
    reason,
    sourceEvidence: [
      extraction.activity_text.evidence_text,
      extraction.asset_tag.evidence_text,
      extraction.discipline.evidence_text
    ].filter((s): s is string => !!s)
  });

  await persistMatch({
    updateId: update.updateId,
    activityId: selectedActivityId,
    matchStatus,
    confidence,
    decision,
    reason,
    candidates: candidates as any,
    scoredCandidates: scored,
    llmExtraction: extraction,
    auditJson
  });

  // Step 7: auto-update only when eligible.
  if ((decision === "AUTO_ACCEPT" || decision === "ACCEPT_MONITOR") && selectedActivityId) {
    await applyVerifiedActual({
      activityId: selectedActivityId,
      updateId: update.updateId,
      extraction,
      fallback: {
        actualStartDate: input.actual_start_date ? new Date(input.actual_start_date) : null,
        actualFinishDate: input.actual_finish_date ? new Date(input.actual_finish_date) : null,
        progressValue: input.progress_value,
        progressUnit: input.progress_unit,
        delayReason: input.delay_reason,
        remarks: input.remarks
      },
      verifiedBy: "AI_AUTO_ACCEPT"
    });
  }

  return {
    updateId: update.updateId,
    result: {
      matchStatus,
      decision,
      activityId: selectedActivityId,
      activityName: selectedActivityName,
      reason,
      confidence,
      candidates: scored,
      llmExtraction: extraction,
      auditJson
    }
  };
}
