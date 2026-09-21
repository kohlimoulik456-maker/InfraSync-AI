import * as XLSX from "xlsx";
import { SCHEDULE_TEMPLATE_HEADERS } from "./services/scheduleImportService";
import { SUPERVISOR_TEMPLATE_HEADERS } from "./inputProcessors/excelProcessor";

function toBuffer(rows: any[][]): Buffer {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

export function generateBlankScheduleTemplate(): Buffer {
  return toBuffer([[...SCHEDULE_TEMPLATE_HEADERS]]);
}

export function generateSampleScheduleTemplate(): Buffer {
  const rows: any[][] = [[...SCHEDULE_TEMPLATE_HEADERS]];
  const sample = [
    [
      "REFINERY-A-2026",
      "Refinery Block A Execution Demo",
      "Block A",
      "Piping",
      "Rack 3",
      "",
      "",
      "",
      "PIP-BLK-A-001",
      "Erect Pipe Spools Line 24-A",
      "PIPING",
      "Rack 3",
      "2026-08-01",
      "2026-08-10",
      9,
      "",
      "ABC Constructors",
      "spool erection, erect spool, line 24-a, pipe spool"
    ],
    [
      "REFINERY-A-2026",
      "Refinery Block A Execution Demo",
      "Block A",
      "Piping",
      "Rack 3",
      "",
      "",
      "",
      "PIP-BLK-A-002",
      "Pipe Support Installation Unit 24",
      "PIPING",
      "Rack 3",
      "2026-08-05",
      "2026-08-12",
      7,
      "PIP-BLK-A-001",
      "ABC Constructors",
      "pipe support, support installation, unit 24"
    ],
    [
      "REFINERY-A-2026",
      "Refinery Block A Execution Demo",
      "Block A",
      "Civil",
      "Block A",
      "",
      "",
      "",
      "CIV-BLK-A-012",
      "Pour Foundation F-12",
      "CIVIL",
      "Block A",
      "2026-07-15",
      "2026-07-20",
      5,
      "",
      "Metro Civil Works",
      "concrete pour, foundation casting, RCC, footing"
    ],
    [
      "REFINERY-A-2026",
      "Refinery Block A Execution Demo",
      "Block A",
      "Civil",
      "Block A",
      "",
      "",
      "",
      "CIV-BLK-A-013",
      "Cure Foundation F-12",
      "CIVIL",
      "Block A",
      "2026-07-21",
      "2026-07-28",
      7,
      "CIV-BLK-A-012",
      "Metro Civil Works",
      "curing, concrete curing, foundation"
    ],
    [
      "REFINERY-A-2026",
      "Refinery Block A Execution Demo",
      "Utility",
      "Electrical",
      "Utility Area",
      "",
      "",
      "",
      "ELEC-U1-018",
      "Pull Cable C-305",
      "ELECTRICAL",
      "Utility Area",
      "2026-08-10",
      "2026-08-14",
      4,
      "",
      "Volt Electricals",
      "cable pulling, cable laid, cable drawing, C-305"
    ]
  ];
  rows.push(...sample);
  return toBuffer(rows);
}

export function generateBlankSupervisorTemplate(): Buffer {
  return toBuffer([[...SUPERVISOR_TEMPLATE_HEADERS]]);
}

export function generateSampleSupervisorTemplate(): Buffer {
  const rows: any[][] = [[...SUPERVISOR_TEMPLATE_HEADERS]];
  const sample = [
    [
      "",
      "REFINERY-A-2026",
      "SUP-101",
      "2026-08-02",
      "Rack 3",
      "PIPING",
      "Piping crew started erection of Line 24-A spool at Rack 3 today at 9 AM. Six workers deployed.",
      "2026-08-02",
      "",
      "",
      "",
      "",
      "Good progress, no issues."
    ],
    [
      "",
      "REFINERY-A-2026",
      "SUP-101",
      "2026-08-06",
      "Pipe Rack",
      "",
      "Spool work completed in Pipe Rack.",
      "",
      "2026-08-06",
      "",
      "",
      "",
      ""
    ],
    [
      "",
      "REFINERY-A-2026",
      "SUP-102",
      "2026-07-20",
      "Block A",
      "CIVIL",
      "Concrete pour for Foundation F-12 completed today. Quantity 45 m3.",
      "",
      "2026-07-20",
      45,
      "m3",
      "",
      "Pour went as scheduled."
    ],
    [
      "",
      "REFINERY-A-2026",
      "SUP-103",
      "2026-08-13",
      "Utility Area",
      "ELECTRICAL",
      "Cable pulling for C-305 completed in Utility Area.",
      "",
      "2026-08-13",
      "",
      "",
      "",
      ""
    ],
    [
      "",
      "REFINERY-A-2026",
      "SUP-102",
      "2026-08-14",
      "",
      "",
      "Work done.",
      "",
      "",
      "",
      "",
      "",
      ""
    ]
  ];
  rows.push(...sample);
  return toBuffer(rows);
}

export function generatePresentationWorkbook(): Buffer {
  const workbook = XLSX.utils.book_new();
  const scheduleRows = [
    [...SCHEDULE_TEMPLATE_HEADERS],
    ["JUDGE-DEMO-2026", "Smart City Infrastructure Demo", "Package 1", "Civil", "Zone A", "", "", "", "CIV-001", "Foundation excavation and PCC", "CIVIL", "Zone A", "2026-08-01", "2026-08-08", 7, "", "Metro Civil Works", "excavation, PCC, foundation"],
    ["JUDGE-DEMO-2026", "Smart City Infrastructure Demo", "Package 1", "Civil", "Zone A", "", "", "", "CIV-002", "Rebar and shuttering for foundation", "CIVIL", "Zone A", "2026-08-09", "2026-08-18", 9, "CIV-001", "Metro Civil Works", "rebar, reinforcement, shuttering"],
    ["JUDGE-DEMO-2026", "Smart City Infrastructure Demo", "Package 2", "Piping", "Utility Block", "", "", "", "PIP-001", "Install process piping Line 24-A", "PIPING", "Utility Block", "2026-08-05", "2026-08-20", 15, "", "ABC Constructors", "piping, spool, line 24-a"],
    ["JUDGE-DEMO-2026", "Smart City Infrastructure Demo", "Package 2", "Piping", "Utility Block", "", "", "", "PIP-002", "Hydrotest process piping Line 24-A", "PIPING", "Utility Block", "2026-08-21", "2026-08-28", 7, "PIP-001", "ABC Constructors", "hydrotest, pressure test"],
    ["JUDGE-DEMO-2026", "Smart City Infrastructure Demo", "Package 3", "Electrical", "Substation", "", "", "", "ELEC-001", "Install substation cable trays", "ELECTRICAL", "Substation", "2026-08-10", "2026-08-22", 12, "", "Volt Electricals", "cable tray, electrical"],
    ["JUDGE-DEMO-2026", "Smart City Infrastructure Demo", "Package 3", "Electrical", "Substation", "", "", "", "ELEC-002", "Pull and terminate power cables", "ELECTRICAL", "Substation", "2026-08-23", "2026-09-02", 10, "ELEC-001", "Volt Electricals", "cable pulling, termination"],
    ["JUDGE-DEMO-2026", "Smart City Infrastructure Demo", "Package 4", "Mechanical", "Plant Room", "", "", "", "MECH-001", "Set mechanical equipment and align pumps", "MECHANICAL", "Plant Room", "2026-08-15", "2026-08-30", 15, "", "Prime Mechanical", "pump, equipment alignment"],
    ["JUDGE-DEMO-2026", "Smart City Infrastructure Demo", "Package 4", "HSE", "All Areas", "", "", "", "HSE-001", "Safety inspection and permit closeout", "HSE", "All Areas", "2026-08-01", "2026-09-05", 35, "", "InfraSafe", "safety inspection, permit"]
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(scheduleRows), "Schedule");

  const fundRows = [
    ["Project_ID", "Transaction_Type", "Amount", "Transaction_Date", "Description", "Category", "Manager"],
    ["JUDGE-DEMO-2026", "RECEIPT", 12500000, "2026-06-01", "Mobilization advance received", "Advance", "Arjun Mehta"],
    ["JUDGE-DEMO-2026", "RECEIPT", 8000000, "2026-07-20", "Milestone payment received", "Progress certificate", "Arjun Mehta"],
    ["JUDGE-DEMO-2026", "RECEIPT", 5500000, "2026-08-25", "Interim payment certificate received", "Progress certificate", "Arjun Mehta"],
    ["JUDGE-DEMO-2026", "EXPENDITURE", 6400000, "2026-06-12", "Civil works and site mobilization", "Construction", "Arjun Mehta"],
    ["JUDGE-DEMO-2026", "EXPENDITURE", 4700000, "2026-07-24", "Piping materials and fabrication", "Materials", "Arjun Mehta"],
    ["JUDGE-DEMO-2026", "EXPENDITURE", 2900000, "2026-08-12", "Electrical equipment procurement", "Procurement", "Arjun Mehta"],
    ["JUDGE-DEMO-2026", "EXPENDITURE", 1600000, "2026-09-04", "Site labor and supervision", "Labor", "Arjun Mehta"]
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(fundRows), "Fund_Transactions");

  const updateRows = [
    [...SUPERVISOR_TEMPLATE_HEADERS],
    ["UPD-001", "JUDGE-DEMO-2026", "SUP-101", "2026-08-08", "Zone A", "CIVIL", "Foundation excavation and PCC completed in Zone A.", "2026-08-01", "2026-08-08", 100, "%", "", "Work completed as planned."],
    ["UPD-002", "JUDGE-DEMO-2026", "SUP-102", "2026-08-20", "Utility Block", "PIPING", "Piping crew completed Line 24-A installation and started preparation for hydrotest.", "2026-08-05", "2026-08-20", 100, "%", "", "Six workers deployed."],
    ["UPD-003", "JUDGE-DEMO-2026", "SUP-103", "2026-08-24", "Substation", "ELECTRICAL", "Cable tray installation is progressing in the substation.", "2026-08-10", "", 65, "%", "Material delivery delay", "Awaiting final tray batch."],
    ["UPD-004", "JUDGE-DEMO-2026", "SUP-104", "2026-09-05", "Plant Room", "MECHANICAL", "Pump alignment completed and mechanical equipment is ready for inspection.", "2026-08-15", "2026-09-05", 90, "%", "", "Inspection requested."],
    ["UPD-005", "JUDGE-DEMO-2026", "SUP-105", "2026-09-06", "All Areas", "HSE", "Daily safety inspection completed with two observations closed.", "", "", 100, "%", "", "Permit closeout recorded."]
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(updateRows), "Supervisor_Updates");

  const instructions = [
    ["InfraSync-AI Judge Demo Workbook"],
    ["Upload this workbook from Start New Project."],
    ["Project ID", "JUDGE-DEMO-2026"],
    ["Required behavior", "The Schedule sheet creates the project. Fund_Transactions seeds live fund tracing. Supervisor_Updates seeds field reporting and AI audit data."],
    ["Expected fund totals", "Received ₹26,000,000 | Used ₹15,600,000 | Remaining ₹10,400,000"]
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(instructions), "Read_Me");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

export function generatePresentationSheet(sheetName: "Schedule" | "Fund_Transactions" | "Supervisor_Updates"): Buffer {
  const source = XLSX.read(generatePresentationWorkbook(), { type: "buffer", cellDates: true });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, source.Sheets[sheetName], sheetName);
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}
