import { NextResponse } from "next/server";
import { generateSampleScheduleTemplate } from "@/lib/templates";

export async function GET() {
  const buffer = generateSampleScheduleTemplate();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="InfraSync_Sample_Schedule.xlsx"'
    }
  });
}
