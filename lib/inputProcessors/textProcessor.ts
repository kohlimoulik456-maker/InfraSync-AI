import { NormalizedSupervisorInput } from "../types";
import { runPipelineForInput } from "../services/pipelineService";

export interface TextUpdateFormInput {
  project_id: string;
  supervisor_id: string;
  update_date: string;
  discipline: string | null;
  area_unit: string | null;
  activity_update_text: string;
  delay_reason: string | null;
  remarks: string | null;
}

export function normalizeTextInput(form: TextUpdateFormInput): NormalizedSupervisorInput {
  return {
    project_id: form.project_id,
    supervisor_id: form.supervisor_id,
    source_type: "TEXT",
    update_date: form.update_date,
    discipline: form.discipline,
    area_unit: form.area_unit,
    activity_description: form.activity_update_text,
    actual_start_date: null,
    actual_finish_date: null,
    progress_value: null,
    progress_unit: null,
    delay_reason: form.delay_reason,
    remarks: form.remarks,
    raw_input: form.activity_update_text,
    metadata: {}
  };
}

export async function processTextUpdate(form: TextUpdateFormInput) {
  const normalized = normalizeTextInput(form);
  return runPipelineForInput(normalized);
}
