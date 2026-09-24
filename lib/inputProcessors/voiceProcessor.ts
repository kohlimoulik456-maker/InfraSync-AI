import { NormalizedSupervisorInput } from "../types";
import { runPipelineForInput } from "../services/pipelineService";
import { normalizeTextInput, TextUpdateFormInput } from "./textProcessor";

export interface VoiceUpdateFormInput extends TextUpdateFormInput {}

export function normalizeVoiceInput(form: VoiceUpdateFormInput): NormalizedSupervisorInput {
  const normalized = normalizeTextInput(form);

  return {
    ...normalized,
    source_type: "VOICE",
    metadata: { ...normalized.metadata, source: "voice" }
  };
}

export async function processVoiceUpdate(form: VoiceUpdateFormInput) {
  const normalized = normalizeVoiceInput(form);
  return runPipelineForInput(normalized);
}
