import { prisma } from "../prisma";
import {
  AuditJson,
  CandidateActivity,
  ConfidenceBreakdown,
  Decision,
  LlmExtraction,
  MatchStatus,
  ScoredCandidate
} from "../types";

export function buildAuditJson(params: {
  activityId: string | null;
  activityName: string | null;
  mappingStatus: MatchStatus;
  candidates: ScoredCandidate[];
  confidence: ConfidenceBreakdown;
  action: Decision;
  requiresHumanReview: boolean;
  reason: string;
  sourceEvidence: string[];
}): AuditJson {
  return {
    activity_mapping: {
      activity_id: params.activityId,
      activity_name: params.activityName,
      mapping_status: params.mappingStatus,
      candidates: params.candidates
    },
    confidence: params.confidence,
    decision: {
      action: params.action,
      requires_human_review: params.requiresHumanReview
    },
    audit: {
      reason: params.reason,
      source_evidence: params.sourceEvidence,
      created_at: new Date().toISOString()
    }
  };
}

export async function persistMatch(params: {
  updateId: string;
  activityId: string | null;
  matchStatus: MatchStatus;
  confidence: ConfidenceBreakdown;
  decision: Decision;
  reason: string;
  candidates: CandidateActivity[] & any;
  scoredCandidates: ScoredCandidate[];
  llmExtraction: LlmExtraction | null;
  auditJson: AuditJson;
}) {
  return prisma.aiActivityMatch.create({
    data: {
      updateId: params.updateId,
      activityId: params.activityId ?? undefined,
      matchStatus: params.matchStatus as any,
      semanticSimilarity: params.confidence.semantic_similarity,
      scheduleConsistency: params.confidence.schedule_consistency,
      contextMatch: params.confidence.context_match,
      ruleValidation: params.confidence.rule_validation,
      overallConfidence: params.confidence.overall_score,
      decision: params.decision as any
    }
  });
}
