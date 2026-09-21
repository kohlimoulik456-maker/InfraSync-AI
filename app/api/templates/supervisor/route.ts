import { NextResponse } from "next/server";
import { generateBlankSupervisorTemplate } from "@/lib/templates";

export async function GET() {
  const buffer = generateBlankSupervisorTemplate();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="InfraSync_Supervisor_Update_Format.xlsx"'
    }
  });
}
