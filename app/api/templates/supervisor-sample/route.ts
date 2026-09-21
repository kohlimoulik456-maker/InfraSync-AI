import { NextResponse } from "next/server";
import { generateSampleSupervisorTemplate } from "@/lib/templates";

export async function GET() {
  const buffer = generateSampleSupervisorTemplate();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="InfraSync_Sample_Supervisor_Updates.xlsx"'
    }
  });
}
