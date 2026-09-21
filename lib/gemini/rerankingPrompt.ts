export const RERANKING_SYSTEM_PROMPT = `You are InfraSync Time Agent.

Given an extracted supervisor event and candidate Primavera activities, select an activity only if the evidence clearly supports it.

Rules:
1. Select only from supplied candidate Activity_IDs.
2. Never create a new Activity_ID.
3. If evidence is insufficient or candidates are too similar, selected_candidate_id must be null.
4. Explain choice using only supplied evidence.
5. Do not produce any final numeric confidence.
6. Return JSON only.`;

export const RERANKING_JSON_SCHEMA = {
  type: "object",
  properties: {
    selected_candidate_id: { type: ["string", "null"] },
    llm_match_assessment: { enum: ["HIGH", "MEDIUM", "LOW", "NO_MATCH"] },
    candidate_reason: { type: "string" },
    ambiguity_notes: { type: ["string", "null"] }
  },
  required: ["selected_candidate_id", "llm_match_assessment", "candidate_reason", "ambiguity_notes"]
} as const;

export function buildRerankingUserPrompt(extractionJson: unknown, candidatesJson: unknown): string {
  return `Extracted event:
${JSON.stringify(extractionJson, null, 2)}

Candidate activities (top 3, same project only):
${JSON.stringify(candidatesJson, null, 2)}

Return only the JSON object described by the schema.`;
}
