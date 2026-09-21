import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { importSchedule } from "@/lib/services/scheduleImportService";
import { processExcelUpload } from "@/lib/inputProcessors/excelProcessor";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const projectId = String(formData.get("project_id") || "").trim();
    const projectName = String(formData.get("project_name") || "").trim();
    const file = formData.get("file") as File | null;

    if (!projectId || !projectName) {
      return NextResponse.json({ error: "Project_ID and Project_Name are required." }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ error: "A schedule file (.xlsx or .csv) is required." }, { status: 400 });
    }
    const filename = file.name.toLowerCase();
    if (!filename.endsWith(".xlsx") && !filename.endsWith(".csv")) {
      return NextResponse.json({ error: "Only .xlsx and .csv files are supported in the MVP." }, { status: 400 });
    }

    const existing = await prisma.project.findUnique({ where: { projectId } });
    if (existing) {
      return NextResponse.json({ error: `Project_ID "${projectId}" already exists. Project_ID must be unique.` }, { status: 409 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { summary, headerErrors } = await importSchedule(buffer, filename, projectId, projectName);

    if (headerErrors.length > 0) {
      return NextResponse.json({ error: "Schedule file is missing required headers.", headerErrors }, { status: 400 });
    }

    let fundTransactionsImported = 0;
    let supervisorUpdatesImported = 0;
    if (filename.endsWith(".xlsx")) {
      const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
      const fundSheet = workbook.Sheets["Fund_Transactions"];
      const fundRows = fundSheet ? XLSX.utils.sheet_to_json<Record<string, any>>(fundSheet, { defval: null }) : [];
      const validFundRows = fundRows.filter((row) => String(row.Project_ID ?? "").trim() === projectId);
      if (validFundRows.length > 0) {
        await prisma.fundTransaction.createMany({
          data: validFundRows.map((row) => ({
            projectId,
            transactionType: String(row.Transaction_Type).trim().toUpperCase(),
            amount: Number(row.Amount),
            transactionDate: new Date(row.Transaction_Date),
            description: String(row.Description ?? "").trim(),
            category: String(row.Category ?? "Other").trim(),
            manager: String(row.Manager ?? "Project Manager").trim()
          }))
        });
        fundTransactionsImported = validFundRows.length;
      }

      const updateSheet = workbook.Sheets["Supervisor_Updates"];
      if (updateSheet) {
        const updateWorkbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(updateWorkbook, updateSheet, "Supervisor_Updates");
        const updateBuffer = XLSX.write(updateWorkbook, { type: "buffer", bookType: "xlsx" });
        const updateSummary = await processExcelUpload(updateBuffer, "Supervisor_Updates.xlsx", projectId, "SUP-DEMO");
        supervisorUpdatesImported = updateSummary.validRows;
      }
    }

    return NextResponse.json({ projectId, summary, fundTransactionsImported, supervisorUpdatesImported });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to import schedule." }, { status: 500 });
  }
}
